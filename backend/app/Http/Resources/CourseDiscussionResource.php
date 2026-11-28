<?php

namespace App\Http\Resources;

use App\Support\Discussions\DiscussionAuthor;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/** @mixin \App\Models\CourseDiscussion */
class CourseDiscussionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $this->resource->loadMissing('author.roles');

        return [
            'id' => $this->id,
            'course_id' => $this->course_id,
            'title' => $this->title,
            'body' => $this->body,
            'author' => DiscussionAuthor::payload($this->author),
            'views' => $this->views,
            'replies_count' => $this->replies_count ?? ($this->relationLoaded('replies') ? $this->replies->count() : null),
            'replies' => CourseDiscussionReplyResource::collection($this->whenLoaded('replies')),
            'is_own' => $user !== null && $this->user_id === $user->id,
            'can_update' => $user !== null && Gate::forUser($user)->allows('update', $this->resource),
            'can_delete' => $user !== null && Gate::forUser($user)->allows('delete', $this->resource),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
