<?php

namespace App\Http\Requests;

use App\Models\Assignment;
use App\Models\AssignmentQuestion;
use App\Models\Course;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** Tambah (POST /courses/{course}/assignments) dan ubah (PATCH /assignments/{assignment}) tugas/kuis/ujian beserta soalnya. */
class AssignmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $assignment = $this->route('assignment');
        $course = $this->route('course') ?? $assignment?->course;

        if ($course instanceof Course && $course->trashed()) {
            abort(404);
        }

        // Ubah tugas memakai policy tugas; tugas baru memakai izin kelola + kepemilikan kursus.
        if ($assignment instanceof Assignment) {
            Gate::authorize('manage', $assignment);
        } else {
            Gate::authorize('create', [Assignment::class, $course]);
        }

        return true;
    }

    private function isUpdate(): bool
    {
        return $this->route('assignment') instanceof Assignment;
    }

    public function rules(): array
    {
        $sometimes = $this->isUpdate() ? ['sometimes'] : [];

        return [
            'title' => [...$sometimes, 'required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'kind' => [...$sometimes, 'required', Rule::in(Assignment::KINDS)],
            'starts_at' => ['nullable', 'date'],
            'due_at' => ['nullable', 'date'],
            'max_score' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'allow_late' => ['sometimes', 'boolean'],
            'late_penalty' => ['nullable', 'integer', 'min:0', 'max:100'],
            'xp_points' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],

            'questions' => [...$sometimes, 'required', 'array', 'min:1'],
            'questions.*.type' => ['required', Rule::in(AssignmentQuestion::TYPES)],
            'questions.*.prompt' => ['required', 'string', 'max:2000'],
            'questions.*.points' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'questions.*.options' => ['nullable', 'array'],
            'questions.*.options.*.id' => ['required_with:questions.*.options'],
            'questions.*.options.*.text' => ['nullable', 'string', 'max:500'],
            'questions.*.correct_option_ids' => ['nullable', 'array'],
            'questions.*.multi_select' => ['sometimes', 'boolean'],
            'questions.*.max_words' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'questions.*.allowed_file_types' => ['nullable', 'array'],
            'questions.*.max_file_size_mb' => ['nullable', 'integer', 'min:1', 'max:100'],
            'questions.*.max_files' => ['nullable', 'integer', 'min:1', 'max:20'],
        ];
    }

    /** @return array<int, callable(\Illuminate\Contracts\Validation\Validator): void> */
    public function after(): array
    {
        return [function ($validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $start = $this->input('starts_at');
            $due = $this->input('due_at');
            if ($start && $due && strtotime($due) < strtotime($start)) {
                $validator->errors()->add('due_at', 'Deadline tidak boleh lebih awal dari tanggal mulai.');
            }

            foreach ((array) $this->input('questions', []) as $index => $question) {
                if (($question['type'] ?? null) === AssignmentQuestion::TYPE_MULTIPLE_CHOICE) {
                    $options = array_filter((array) ($question['options'] ?? []), fn ($option) => trim((string) ($option['text'] ?? '')) !== '');
                    if (count($options) < 2) {
                        $validator->errors()->add("questions.{$index}.options", 'Pilihan ganda membutuhkan minimal dua opsi jawaban.');
                    }
                }
            }
        }];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Judul tugas wajib diisi.',
            'title.max' => 'Judul tugas maksimal 150 karakter.',
            'kind.required' => 'Tipe evaluasi wajib dipilih.',
            'kind.in' => 'Tipe evaluasi tidak dikenal.',
            'questions.required' => 'Tambahkan minimal satu soal.',
            'questions.min' => 'Tambahkan minimal satu soal.',
            'questions.*.type.in' => 'Tipe soal tidak dikenal.',
            'questions.*.prompt.required' => 'Teks soal wajib diisi.',
            'due_at.date' => 'Deadline tidak valid.',
            'starts_at.date' => 'Tanggal mulai tidak valid.',
        ];
    }
}
