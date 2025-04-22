"use client";
import React, { useState, useEffect } from 'react';
import { getParticipants, getPrizepool, checkPending } from '../lib/api';
import WheelComponent, { Participant } from '../components/Wheel';
import TimerDisplay from '../components/TimerDisplay';
import ParticipantList from '../components/ParticipantList';
import ParticipateModal from '../components/ParticipateModal';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import InstructionModal from '../components/InstructionModal';
import HistoryModal from '../components/HistoryModal';
import DuplicateModal from '../components/DuplicateModal';

export default function Home() {
  const [participants, setParticipants] = useState<string[]>([]);
  const [prizePool, setPrizePool] = useState<number>(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [telegramId, setTelegramId] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [instrOpen, setInstrOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState<string>('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const reload = () => getParticipants().then(setParticipants).catch(console.error);

  useEffect(() => {
    reload();
    if (typeof window !== 'undefined') {
      // Fallback: get telegramId from URL params
      const params = new URLSearchParams(window.location.search);
      const tidParam = params.get('telegramId');
      if (tidParam) setTelegramId(tidParam);
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        const user = window.Telegram.WebApp.initDataUnsafe?.user;
        if (user?.id) setTelegramId(user.id.toString());
      }
    }
    getPrizepool().then(data => setPrizePool(data.total)).catch(console.error);
    // TimerDisplay handles timer polling and auto-spin
    const interval = setInterval(() => {}, 1000);
    return () => clearInterval(interval);
  }, []);

  const colors = ["#fa709a", "#fee140", "#00c9ff", "#92fe9d", "#f5576c", "#4facfe", "#43e97b", "#38f9d7"];
  const participantsWithColor: Participant[] = participants.length > 0
    ? participants.map((name, idx) => ({ id: name, color: colors[idx % colors.length] }))
    : [{ id: 'fallback', color: colors[0] }];

  const handleParticipate = async () => {
    if (!telegramId) {
      setModalOpen(true);
      return;
    }
    try {
      await checkPending(telegramId);
      setModalOpen(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка при проверке участия';
      setDuplicateMessage(msg);
      setShowDuplicateModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-0 flex flex-col">
      <Navbar onMenuToggleAction={() => setSidebarOpen(true)} />
      <Sidebar
        isOpen={sidebarOpen}
        onShowInstructions={() => { setInstrOpen(true); setSidebarOpen(false); }}
        onShowHistory={() => { setHistoryOpen(true); setSidebarOpen(false); }}
        onClose={() => setSidebarOpen(false)}
      />
      <InstructionModal isOpen={instrOpen} onClose={() => setInstrOpen(false)} />
      <HistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
      <div className="pt-16 p-6 flex-1 flex flex-col items-center space-y-4">
        <div className="mb-6 w-full max-w-md bg-gray-900 bg-opacity-90 backdrop-blur-md p-4 rounded-md text-center">
          <p className="text-white mb-2">До следующего розыгрыша:</p>
          <TimerDisplay initialTime={3600} />
          <div className="mt-2 text-center">
            <p className="text-white text-xl font-bold">Призовой фонд:</p>
            <p className="text-green-400 text-3xl font-bold">{prizePool > 0 ? prizePool : 0}₽</p>
          </div>
        </div>
        <WheelComponent participants={participantsWithColor} />
        {/* Unified Participate & Participants container */}
        <div className="w-full max-w-md flex flex-col space-y-2">
          <button
            onClick={handleParticipate}
            className="participate-btn w-full rounded-full"
          >
            Участвовать
          </button>
          <ParticipateModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            onSuccess={reload}
            telegramId={telegramId}
          />
          <div className="bg-gray-800 p-4 rounded-b-xl">
            <ParticipantList participants={participants} />
          </div>
        </div>
      </div>
      <DuplicateModal
        isOpen={showDuplicateModal}
        message={duplicateMessage}
        onClose={() => setShowDuplicateModal(false)}
      />
    </div>
  );
}
