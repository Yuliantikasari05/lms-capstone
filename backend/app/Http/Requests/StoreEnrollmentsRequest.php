<?php

namespace App\Http\Requests;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Role;
use App\Models\User;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Mendaftarkan banyak peserta sekaligus (maks. 100). Semua-atau-tidak-sama-sekali: bila satu id tidak valid,
 * tidak ada yang didaftarkan dan kesalahan disebut per urutan (user_ids.N).
 */
class StoreEnrollmentsRequest extends FormRequest
{
    public const MAX = 100;

    public function authorize(): bool
    {
        /** @var Course $course */
        $course = $this->route('course');
        abort_if($course->trashed(), 404);

        Gate::authorize('manageEnrollments', $course);

        return true;
    }

    public function rules(): array
    {
        return [
            'user_ids' => ['required', 'array', 'min:1', 'max:'.self::MAX],
            'user_ids.*' => ['integer', 'distinct'],
        ];
    }

    /** @return array<int, callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            /** @var Course $course */
            $course = $this->route('course');
            $ids = array_map('intval', $this->input('user_ids'));

            $users = User::query()->with('roles')->whereIn('id', $ids)->get()->keyBy('id');
            $enrolled = Enrollment::query()
                ->where('course_id', $course->id)->where('status', Enrollment::STATUS_ACTIVE)->whereIn('user_id', $ids)
                ->pluck('user_id')->flip();

            $role = $course->participantRole();
            $roleName = $role === Role::KARYAWAN ? 'Karyawan' : 'Siswa';

            foreach ($ids as $index => $id) {
                $user = $users->get($id);
                $key = "user_ids.{$index}";

                if (! $user) {
                    $validator->errors()->add($key, 'Pengguna tidak ditemukan.');
                } elseif (! $user->isActive()) {
                    $validator->errors()->add($key, "Akun {$user->name} tidak aktif.");
                } elseif (! $user->hasRole($role)) {
                    $validator->errors()->add($key, "{$user->name} bukan {$roleName}. Kursus {$course->typeLabel()} hanya untuk {$roleName}.");
                } elseif ($enrolled->has($id)) {
                    $validator->errors()->add($key, "{$user->name} sudah terdaftar di kursus ini.");
                }
            }
        }];
    }

    public function messages(): array
    {
        return [
            'user_ids.required' => 'Pilih minimal satu peserta.',
            'user_ids.array' => 'Daftar peserta tidak valid.',
            'user_ids.min' => 'Pilih minimal satu peserta.',
            'user_ids.max' => 'Maksimal '.self::MAX.' peserta sekali daftar.',
            'user_ids.*.integer' => 'Peserta tidak valid.',
            'user_ids.*.distinct' => 'Peserta yang sama dipilih lebih dari sekali.',
        ];
    }
}
