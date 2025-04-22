"use client";
import React, { useState } from 'react';
import { postPending } from '../lib/api';

interface ParticipateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  telegramId: string;
}

export default function ParticipateModal({ isOpen, onClose, onSuccess, telegramId }: ParticipateModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  // Allow manual Telegram ID input for local testing when not provided
  const [localTid, setLocalTid] = useState(telegramId);

  const handleApprove = async () => {
    console.log('handleApprove triggered', { name, telegramId, localTid });
    const effectiveTid = telegramId || localTid;
    console.log('Effective Telegram ID:', effectiveTid);
    if (!name.trim()) { alert('Введите имя'); return; }
    if (!effectiveTid) { alert('Введите Telegram ID'); return; }
    setLoading(true);
    try {
      console.log('Posting pending to API', { name: name.trim(), telegramId: effectiveTid });
      await postPending(name.trim(), effectiveTid);
      console.log('postPending successful');
      alert('Заявка отправлена!');
      onSuccess();
      setName('');
      onClose();
    } catch (e) {
      console.error('postPending error', e);
      console.error(e);
      alert(e instanceof Error ? e.message : 'Ошибка при отправке заявки');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center modal">
      <div className="bg-gray-800 p-6 rounded shadow-lg">
        <h3 className="text-lg font-semibold mb-4 text-white">Участвовать</h3>
        <input
          type="text"
          className="w-full p-2 mb-2 bg-gray-700 text-white rounded"
          placeholder="Ваше имя"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        {/* Телеграм ID для локального тестирования */}
        {!telegramId && (
          <input
            type="text"
            className="w-full p-2 mb-2 bg-gray-700 text-white rounded"
            placeholder="Telegram ID"
            value={localTid || ''}
            onChange={e => setLocalTid(e.target.value)}
          />
        )}
        <p className="text-sm mb-4">Оплатите участие: +79536029130 (СБП Озон Банк)</p>
        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded">Отмена</button>
          <button onClick={handleApprove} disabled={loading} className="participate-btn text-white rounded-full px-4 py-2">
            {loading ? '...' : 'Оплатил'}
          </button>
        </div>
      </div>
    </div>
  );
}
