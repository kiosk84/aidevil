"use client";
import React, { useState, useEffect } from 'react';
import { getParticipants, getPrizepool, checkPending, getPending, getDetailedParticipants, ParticipantWithNumber } from '../lib/api';
import WheelComponent, { Participant } from '../components/Wheel';
import TimerDisplay from '../components/TimerDisplay';
import ParticipantList from '../components/ParticipantList';
import ParticipateModal from '../components/ParticipateModalNew';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import InstructionModal from '../components/InstructionModal';
import HistoryModal from '../components/HistoryModal';
import DuplicateModal from '../components/DuplicateModal';
import PendingModal from '../components/PendingModal';
import SplashScreen from '../components/SplashScreen';

export default function Home() {
  const [participants, setParticipants] = useState<string[]>([]);
  const [detailedParticipants, setDetailedParticipants] = useState<ParticipantWithNumber[]>([]);
  const [pendingUsers, setPendingUsers] = useState<string[]>([]);
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

  // Функция для обновления данных
  const reload = () => {
    // Загружаем список участников (обычный и детальный)
    getParticipants().then(setParticipants).catch(console.error);
    getDetailedParticipants().then(setDetailedParticipants).catch(console.error);

    // Загружаем список ожидающих подтверждения
    getPending().then(data => {
      const pendingNames = data.map(item => item.name);
      setPendingUsers(pendingNames);
    }).catch(console.error);
  };

  useEffect(() => {
    reload();
    if (typeof window !== 'undefined') {
      // Fallback: get telegramId from URL params
      const params = new URLSearchParams(window.location.search);
      const tidParam = params.get('telegramId');
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

  // Более яркие и контрастные цвета для колеса
  const colors = [
    "#FF6B6B", // красный
    "#4ECDC4", // бирюзовый
    "#FFE66D", // желтый
    "#6A0572", // фиолетовый
    "#1A936F", // зеленый
    "#3A86FF", // синий
    "#FB5607", // оранжевый
    "#8338EC"  // пурпурный
  ];

  // Создаем участников для колеса с номерами
  const participantsWithColor: Participant[] = participants.length > 0
    ? detailedParticipants.map((p) => ({
        id: p.name,
        color: colors[p.number % colors.length],
        number: p.number // Добавляем номер участника
      }))
    : [{ id: 'fallback', color: colors[0] }];

  const handleParticipate = async () => {
    if (!telegramId) {
      setModalOpen(true);
      return;
    }

    // Если пользователь - админ, сразу открываем модальное окно без проверки
    if (telegramId === process.env.NEXT_PUBLIC_ADMIN_ID || telegramId === '123456789') { // Используем переменную окружения или тестовый ID
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
      <div className="flex-1 flex flex-col items-center justify-evenly px-2 sm:px-4 pt-4 sm:pt-6 pb-1 min-h-0 max-w-screen-sm mx-auto w-full">
        <div className="mb-2 sm:mb-3 w-full bg-gray-900 bg-opacity-90 backdrop-blur-md p-2 sm:p-3 rounded-md text-center">
          <p className="text-white text-xs sm:text-sm mb-1">До следующего розыгрыша:</p>
          <TimerDisplay />
          <div className="mt-1 text-center">
            <p className="text-white text-sm sm:text-base font-bold">Призовой фонд:</p>
            <p className="text-green-400 text-xl sm:text-2xl font-bold">{prizePool > 0 ? prizePool : 0}₽</p>
          </div>
        </div>

        {/* Колесо с эффектом свечения */}
        <div className="-mt-2 sm:-mt-4 neon-glow p-2 mb-2 sm:mb-3">
          <WheelComponent participants={participantsWithColor} />
        </div>

        {/* Unified Participate & Participants container */}
        <div className="w-full flex flex-col space-y-1">
          <button
            onClick={handleParticipate}
            className="participate-btn w-full rounded-full py-1.5 sm:py-2 text-xs sm:text-sm"
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
          <div className="bg-gray-800 p-3 sm:p-4 rounded-b-xl">
            <ParticipantList
              participants={participants}
              pendingUsers={pendingUsers}
            />
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
