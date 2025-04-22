"use client";
import React from 'react';

interface InstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InstructionModal({ isOpen, onClose }: InstructionModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center modal">
      <div className="bg-gray-800 p-6 rounded shadow-lg max-w-lg mx-4">
        <h3 className="text-xl font-semibold mb-4 text-white">Инструкция</h3>
        <div className="text-white mb-4 space-y-2">
          <p>1. Нажмите «Участвовать» и введите свое имя.</p>
          <p>2. Оплатите участие по реквизитам.</p>
          <p>3. Дождитесь подтверждения администратора.</p>
          <p>4. После автоспина вы увидите победителя.</p>
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded">Закрыть</button>
        </div>
      </div>
    </div>
  );
}
