// app/checklist/_components/ChecklistHeader.tsx
"use client";

import { SlidersHorizontal } from 'lucide-react';

// Props que o componente receberá
interface ChecklistHeaderProps {
  userName: string | null;
  totalTasks: number;
  completedTasks: number;
}

export function ChecklistHeader({ userName, totalTasks, completedTasks }: ChecklistHeaderProps) {
  // Lógica para obter a data atual em português
  const today = new Date();
  const dateString = today.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
  });

  const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const tasksLeft = totalTasks - completedTasks;

  return (
    <div className="rounded-xl bg-gradient-to-r from-lime-300 via-yellow-200 to-green-300 p-6 text-black shadow-lg">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold">Olá, {userName || 'Executor'}!</h1>
          <p className="text-lg text-gray-800">{dateString}</p>
        </div>
        <button className="p-2 rounded-full hover:bg-black/10 transition-colors">
          <SlidersHorizontal size={24} />
        </button>
      </div>
      <div className="mt-8 flex items-center justify-between">
        <p className="font-semibold">{tasksLeft} tarefa{tasksLeft !== 1 ? 's restantes' : ' restante'}</p>
        <div className="w-1/2 bg-black/20 rounded-full h-2.5">
          <div 
            className="bg-black h-2.5 rounded-full" 
            style={{ width: `${progressPercentage}%`, transition: 'width 0.5s ease-in-out' }}
          ></div>
        </div>
      </div>
    </div>
  );
}