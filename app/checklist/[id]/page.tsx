// app/checklist/[id]/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { notFound, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ThumbsUp, 
  ThumbsDown,
  Info, // Ícone de informação para o cabeçalho
  MapPin, // Ícone de localização para o cabeçalho
} from 'lucide-react';

// Componentes UI do Shadcn
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils'; // Utilitário do Shadcn para classes condicionais

// --- Configurações do Supabase e Sons ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUCCESS_SOUND_URL = "https://mdboxppkyxfxwtuwcpcz.supabase.co/storage/v1/object/public/checklist-photos/public/successed-295058.mp3"; // <-- ATUALIZE ESTA URL!

// Tipos de dados
type ChecklistData = {
  name: string;
  assigned_user_id: string; 
};

type UserData = {
  name: string;
  role: string;
};

// Perguntas mockadas com descrição
const MOCKED_QUESTIONS = [
  { id: 'q1', text: 'Cintos de segurança funcionam perfeitamente?', description: 'Verifique todos os cintos presente no veículo.' },
  { id: 'q2', text: 'Os pneus estão em bom estado?', description: 'Considerar steps quando houver.' },
  { id: 'q3', text: 'As rodas estão em bom estado?', description: 'Informe as condições das rodas.' },
];

export default function ChecklistPage() {
  const params = useParams();
  const checklistId = params.id as string;

  // --- Estados da Aplicação ---
  const [checklist, setChecklist] = useState<ChecklistData | null>(null);
  const [executor, setExecutor] = useState<UserData | null>(null);
  const [answers, setAnswers] = useState<Record<string, { answer: string; photo?: File | null }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // --- Supabase Client ---
  const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // --- Audio Ref para tocar o som ---
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Efeito para carregar Checklist e Executor ---
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const { data: checklistData, error: checklistError } = await supabase.from('checklists').select('name, assigned_user_id').eq('id', checklistId).single<ChecklistData>();
      if (checklistError || !checklistData) { notFound(); return; }
      setChecklist(checklistData);
      const { data: userData, error: userError } = await supabase.from('users').select('name, role').eq('id', checklistData.assigned_user_id).single<UserData>();
      if (userData) { setExecutor(userData); }
      setIsLoading(false);
    }
    fetchData();
  }, [checklistId]);

  // --- Handlers ---
  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], answer: value } }));
  };

  const handlePhotoChange = (questionId: string, file: File | null) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], photo: file } }));
  };

  // --- Lógica de Submissão ---
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || !checklist?.assigned_user_id) return;

    for (const q of MOCKED_QUESTIONS) {
      if (!answers[q.id]?.answer) {
        alert(`Por favor, responda à pergunta: "${q.text}"`);
        return;
      }
      if (answers[q.id]?.answer === 'nao' && !answers[q.id]?.photo) {
        alert(`Por favor, anexe uma foto para a pergunta: "${q.text}"`);
        return;
      }
    }

    setIsSubmitting(true);
    const finalAnswers: Record<string, { answer: string; photo_url: string | null }> = {};
    let hasNonCompliance = false;

    for (const questionId in answers) {
      const currentAnswer = answers[questionId];
      finalAnswers[questionId] = { answer: currentAnswer.answer, photo_url: null };

      if (currentAnswer.answer === 'nao') {
        hasNonCompliance = true;
        if (currentAnswer.photo) {
          const photo = currentAnswer.photo;
          const filePath = `public/${checklistId}/${questionId}-${Date.now()}-${photo.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage.from('checklist-photos').upload(filePath, photo);
          if (uploadError) {
            alert(`Erro no upload da foto. Tente novamente.`);
            setIsSubmitting(false);
            return;
          }
          const { data: publicUrlData } = supabase.storage.from('checklist-photos').getPublicUrl(uploadData.path);
          finalAnswers[questionId].photo_url = publicUrlData.publicUrl;
        }
      }
    }

    const { error: insertError } = await supabase.from('submissions').insert({
      checklist_id: checklistId,
      executor_id: checklist.assigned_user_id,
      answers: finalAnswers,
      has_non_compliance: hasNonCompliance,
    });

    if (insertError) {
      alert("Ocorreu um erro ao salvar o checklist.");
    } else {
      setShowSuccessModal(true);
      if (audioRef.current) { audioRef.current.play(); }
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-gray-100 font-sans">
      <div className="bg-purple-800 p-4 shadow-md flex justify-between items-center text-white">
        <Button variant="ghost" size="icon"><XCircle /></Button>
        <h1 className="font-bold text-lg">{checklist?.name}</h1>
        <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon"><MapPin /></Button>
            <Button variant="ghost" size="icon"><Info /></Button>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {MOCKED_QUESTIONS.map((question, index) => (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white p-5 rounded-xl shadow-sm border border-gray-200"
            >
              <div className="flex flex-col">
                <p className="text-lg font-semibold text-gray-800">{question.text}</p>
                <p className="text-sm text-gray-500 mt-1">{question.description}</p>
              </div>

              {/* A MÁGICA DOS BOTÕES DE JOINHA */}
              <RadioGroup onValueChange={(value) => handleAnswerChange(question.id, value)} className="grid grid-cols-2 gap-4 mt-4">
                {/* Botão Não */}
                <div>
                  <RadioGroupItem value="nao" id={`${question.id}-nao`} className="sr-only" />
                  <Label 
                    htmlFor={`${question.id}-nao`}
                    className={cn(
                        "flex flex-col items-center justify-center rounded-md border-2 p-4 text-lg font-semibold cursor-pointer transition-all",
                        answers[question.id]?.answer === 'nao' 
                          ? "bg-red-500 border-red-600 text-white ring-2 ring-offset-2 ring-red-500" 
                          : "bg-white border-gray-300 text-red-500 hover:bg-red-50"
                    )}
                  >
                    <ThumbsDown className="mb-2 h-7 w-7" />
                    Não
                  </Label>
                </div>
                {/* Botão Sim */}
                <div>
                  <RadioGroupItem value="sim" id={`${question.id}-sim`} className="sr-only" />
                  <Label 
                    htmlFor={`${question.id}-sim`}
                    className={cn(
                        "flex flex-col items-center justify-center rounded-md border-2 p-4 text-lg font-semibold cursor-pointer transition-all",
                        answers[question.id]?.answer === 'sim' 
                          ? "bg-green-500 border-green-600 text-white ring-2 ring-offset-2 ring-green-500" 
                          : "bg-white border-gray-300 text-green-600 hover:bg-green-50"
                    )}
                  >
                    <ThumbsUp className="mb-2 h-7 w-7" />
                    Sim
                  </Label>
                </div>
              </RadioGroup>

              <AnimatePresence>
                {answers[question.id]?.answer === 'nao' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: '16px' }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col space-y-2"
                  >
                    <Label htmlFor={`photo-${question.id}`} className="font-semibold text-red-700">Anexar Foto (Obrigatório)</Label>
                    <Input id={`photo-${question.id}`} type="file" required accept="image/*" capture="environment" onChange={(e) => handlePhotoChange(question.id, e.target.files ? e.target.files[0] : null)} />
                  </motion.div>
                )}
              </AnimatePresence>

               {/* Botão de Repetir (Estético por enquanto) */}
               <div className="flex justify-center mt-4">
                 <Button type="button" variant="ghost" className="text-gray-500">REPETIR +</Button>
               </div>

            </motion.div>
          ))}
          
          <div className="pt-6">
            <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-4 px-6 rounded-lg text-xl transition-transform transform hover:scale-105"
              >
                {isSubmitting ? <><Loader2 className="h-6 w-6 mr-3 animate-spin" /> ENVIANDO...</> : 'FINALIZAR CHECKLIST'}
            </Button>
          </div>
        </form>
      </div>

      {/* Modal de Sucesso (continua o mesmo) */}
      <AnimatePresence>
        {showSuccessModal && (
          <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
            <DialogContent className="sm:max-w-[425px] p-6 text-center">
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }} className="flex flex-col items-center justify-center p-4">
                <CheckCircle2 className="h-20 w-20 text-green-500 mb-4" />
                <DialogHeader>
                  <DialogTitle className="text-3xl font-bold text-gray-800">Checklist Concluído!</DialogTitle>
                  <DialogDescription className="text-gray-600 text-lg mt-2">Suas respostas foram salvas com sucesso.</DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-6 w-full">
                  <Button onClick={() => window.location.reload()} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg">Concluir</Button>
                </DialogFooter>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      <audio ref={audioRef} src={SUCCESS_SOUND_URL} preload="auto" />
    </main>
  );
}