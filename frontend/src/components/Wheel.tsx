"use client";
import React, { useState } from 'react';
import { Wheel } from 'react-custom-roulette';
import { spinWheel } from '../lib/api';

interface WheelComponentProps {
  participants: string[];
}

const WheelComponent: React.FC<WheelComponentProps> = ({ participants }) => {
  const [mustSpin, setMustSpin] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  const data = participants.map(name => ({ option: name }));

  const handleSpinClick = () => {
    if (participants.length === 0) return;
    setMustSpin(true);
  };

  const handleStopSpinning = async (prizeIndex: number) => {
    const selected = data[prizeIndex].option;
    setWinner(selected);
    setMustSpin(false);
    try {
      const res = await spinWheel();
      console.log('Server spin result', res);
      // Refresh participants list after spin
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <Wheel
        mustStartSpinning={mustSpin}
        data={data}
        // @ts-ignore: react-custom-roulette typedef mismatch for onStopSpinning
        onStopSpinning={handleStopSpinning}
        backgroundColors={["#3e3e3e", "#1a1a1a"]}
        textColors={["#ffffff"]}
        outerBorderColor="#f2f2f2"
        outerBorderWidth={5}
        innerBorderColor="#e5e5e5"
        innerBorderWidth={15}
        radiusLineColor="#ffffff"
      />
      <button
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        onClick={handleSpinClick}
        disabled={mustSpin || participants.length === 0}
      >
        Вращать
      </button>
      {winner && <div className="mt-4 text-xl">Победитель: <span className="font-bold">{winner}</span></div>}
    </div>
  );
};

export default WheelComponent;
