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
import PendingModal from '../components/PendingModal';
import SplashScreen from '../components/SplashScreen';

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
  const [showPending, setShowPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const reload = () => getParticipants().then(setParticipants).catch(console.error);

  useEffect(() => {
    reload();
    if (typeof window !== 'undefined') {
      // Fallback: get telegramId from URL params
      const params = new URLSearchParams(window.location.search);
      let tidParam = params.get('telegramId');
      // ВРЕМЕННО для теста: если нет telegramId, подставлять test_user1 или test_user2 по query-параметру ?test=1 или ?test=2
      const testParam = params.get('test');
      if (!tidParam) {
        if (testParam === '2') tidParam = 'test_user2';
        else tidParam = 'test_user1';
      }
      setTelegramId(tidParam || '');
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

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
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

  if (loading) return <SplashScreen />;
  return (
    <div className="min-h-screen bg-gray-900 text-white p-0 flex flex-col">
      <Navbar onMenuToggleAction={() => setSidebarOpen(true)} />
      <Sidebar
        isOpen={sidebarOpen}
        onShowInstructionsAction={() => { setInstrOpen(true); setSidebarOpen(false); }}
        onShowHistoryAction={() => { setHistoryOpen(true); setSidebarOpen(false); }}
        onCloseAction={() => setSidebarOpen(false)}
      />
      <InstructionModal isOpen={instrOpen} onClose={() => setInstrOpen(false)} />
      <HistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
      <div className="flex-1 flex flex-col items-center justify-evenly px-2 pt-6 pb-1 min-h-0">
        <div className="mb-4 w-full max-w-md bg-gray-900 bg-opacity-90 backdrop-blur-md p-4 rounded-md text-center">
          <p className="text-white mb-2">До следующего розыгрыша:</p>
          <TimerDisplay />
          <div className="mt-2 text-center">
            <p className="text-white text-xl font-bold">Призовой фонд:</p>
            <p className="text-green-400 text-3xl font-bold">{prizePool > 0 ? prizePool : 0}₽</p>
          </div>
        </div>
        <div className="-mt-6 neon-glow p-2 mb-4">
          <WheelComponent participants={participantsWithColor} />
        </div>
        {/* Unified Participate & Participants container */}
        <div className="w-full max-w-md flex flex-col space-y-1">
          <button
            onClick={handleParticipate}
            className="participate-btn w-full rounded-full"
          >
            Участвовать
          </button>
          <ParticipateModal
            isOpen={modalOpen}
            onCloseAction={() => setModalOpen(false)}
            onSuccessAction={reload}
            telegramId={telegramId}
          />
          <PendingModal isOpen={showPending} onClose={() => setShowPending(false)} />
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
