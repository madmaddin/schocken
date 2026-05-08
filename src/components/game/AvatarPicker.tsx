'use client';

export const HUMAN_AVATARS = [
  '😎', '🤠', '🥳', '🤓', '🥸', '👻',
  '🦊', '🐻', '🐺', '🦁', '🐸', '🐧',
  '🎩', '🧙', '🫡', '😈', '🤩', '🤯',
];

export const DEFAULT_HUMAN_AVATAR = HUMAN_AVATARS[0];

export function AvatarPicker({ value, onChange }: { value: string; onChange: (avatar: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {HUMAN_AVATARS.map(emoji => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all
            ${value === emoji
              ? 'bg-amber-500 ring-2 ring-amber-300 scale-110'
              : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
