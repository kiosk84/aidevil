"use client";
import React from 'react';

interface ParticipantListProps {
  participants: string[];
}

export default function ParticipantList({ participants }: ParticipantListProps) {
  return (
    <div className="text-white">
      <h2 className="text-center text-lg font-semibold mb-1 gradient-text">Участники</h2>
      <ul className="list-disc list-inside space-y-1 max-h-48 overflow-y-auto">
        {participants.length > 0 ? (
          participants.map((name, idx) => (
            <li key={idx} className="px-2 py-1 bg-gray-700 rounded">{name}</li>
          ))
        ) : (
          <li className="px-2 py-1 bg-gray-700 rounded">Нет участников</li>
        )}
      </ul>
    </div>
  );
}
