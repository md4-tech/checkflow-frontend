// app/checklist/[id]/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { notFound, useParams } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, Loader2, ThumbsUp, ThumbsDown,
  Info, MapPin, XCircle, UploadCloud, Trash2
} from 'lucide-react';

// Componentes UI do Shadcn
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from '@/lib/utils';

// --- Configurações ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUCCESS_SOUND_URL = "https://mdboxppkyxfxwtuwcpcz.supabase.co/storage/v1/object/public/checklist-photos/public/successed-295058.mp3"; // ATUALIZE ESTA URL!

// --- Tipos de Dados ---
type ChecklistData = { name: string; assigned_user_id: string; };
type UserData = { name: string; role: string; };
type Question = { id: string; text: string; description?: string; };
type AnswerState = { answer?: string; photos?: File[] };

const MOCKED_QUESTIONS: Question[] = [
  { id: 'q1', text: 'Cintos de segurança funcionam perfeitamente?', description: 'Verifique todos os cintos presente no veículo.' },
  { id: 'q2', text: 'Os pneus estão em bom estado?', description: 'Considerar steps quando houver.' },
  { id: 'q3', text: 'As rodas estão em bom estado?', description: 'Informe as condições das rodas.' },
];

export default function ChecklistPage() {
  const params = useParams();
  const checklistId = params.id as string;

  const [checklistName, setChecklistName] = useState<string>('');
  const [executor, setExecutor] = useState<UserData | null>(null);
  const [executorId, setExecutorId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<Record<string, HTMLInputElement | null>>({});

  const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const { data: cData, error: cError } = await supabase.from('checklists').select('name, assigned_user_id').eq('id', checklistId).single<ChecklistData>();
      if (cError || !cData) { notFound(); return; }
      
      setChecklistName(cData.name);
      setExecutorId(cData.assigned_user_id);

      const { data: uData } = await supabase.from('users').select('name, role').eq('id', cData.assigned_user_id).single<UserData>();
      if (uData) setExecutor(uData);
      setIsLoading(false);
    }
    fetchData();
  }, [checklistId, supabase]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], answer: value } }));
  };

  // CORREÇÃO AQUI: Lógica de estado corrigida para adicionar múltiplas fotos
  const handlePhotoChange = (questionId: string, files: FileList | null) => {
    if (!files) return;
    const newPhotos = Array.from(files);
    setAnswers(prev => {
        const existingPhotos = prev[questionId]?.photos || [];
        return {
            ...prev,
            [questionId]: {
                ...prev[questionId],
                answer: prev[questionId]?.answer || 'nao',
                photos: [...existingPhotos, ...newPhotos],
            }
        };
    });
  };
  
  const handleRemovePhoto = (questionId: string, photoIndex: number) => {
    setAnswers(prev => {
      const currentPhotos = prev[questionId]?.photos || [];
      const newPhotos = currentPhotos.filter((_, index) => index !== photoIndex);
      return { ...prev, [questionId]: { ...prev[questionId], photos: newPhotos } };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || !executorId) return;

    for (const q of MOCKED_QUESTIONS) {
        const currentAnswer = answers[q.id];
        if (!currentAnswer?.answer) {
            alert(`Por favor, responda à pergunta: "${q.text}"`);
            return;
        }
        if (currentAnswer.answer === 'nao' && (!currentAnswer.photos || currentAnswer.photos.length === 0)) {
            alert(`Por favor, anexe pelo menos uma foto para a pergunta: "${q.text}"`);
            return;
        }
    }

    setIsSubmitting(true);
    const finalAnswers: Record<string, { answer: string; photo_urls: string[] | null }> = {};
    let hasNonCompliance = false;

    for (const questionId in answers) {
      const currentAnswer = answers[questionId];
      if(!currentAnswer.answer) continue; // Ignora perguntas não respondidas
      
      finalAnswers[questionId] = { answer: currentAnswer.answer, photo_urls: null };
      
      if (currentAnswer.answer === 'nao' && currentAnswer.photos && currentAnswer.photos.length > 0) {
        hasNonCompliance = true;
        const uploadPromises = currentAnswer.photos.map(photo => {
            const filePath = `public/${checklistId}/${questionId}-${Date.now()}-${photo.name}`;
            return supabase.storage.from('checklist-photos').upload(filePath, photo);
        });
        const uploadResults = await Promise.all(uploadPromises);

        const urls: string[] = [];
        for (const result of uploadResults) {
            if (result.error) {
                alert(`Erro no upload. Tente novamente.`);
                setIsSubmitting(false);
                return;
            }
            const { data: publicUrlData } = supabase.storage.from('checklist-photos').getPublicUrl(result.data.path);
            urls.push(publicUrlData.publicUrl);
        }
        finalAnswers[questionId].photo_urls = urls;
      }
    }
    
    const { error: insertError } = await supabase.from('submissions').insert({
        checklist_id: checklistId,
        executor_id: executorId,
        answers: finalAnswers,
        has_non_compliance: hasNonCompliance,
    });

    if (insertError) {
        alert("Ocorreu um erro ao salvar.");
    } else {
        setShowSuccessModal(true);
        if (audioRef.current) { audioRef.current.play(); }
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return ( <main className="flex min-h-screen w-full items-center justify-center bg-gray-50"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></main> );
  }

  return (
    <main className="min-h-screen w-full bg-gray-100 font-sans">
      <div className="bg-purple-800 p-4 shadow-md flex justify-between items-center text-white sticky top-0 z-10">
        <Button variant="ghost" size="icon"><XCircle /></Button>
        <div className="text-center">
            <h1 className="font-bold text-lg truncate">{checklistName}</h1>
            {executor && <p className="text-xs text-purple-200">{`Executor: ${executor.name}`}</p>}
        </div>
        <div className="flex items-center space-x-2"><Button variant="ghost" size="icon"><MapPin /></Button><Button variant="ghost" size="icon"><Info /></Button></div>
      </div>
      <div className="p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {MOCKED_QUESTIONS.map((question) => (
            <motion.div key={question.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <div className="flex flex-col"><p className="text-lg font-semibold text-gray-800">{question.text}</p><p className="text-sm text-gray-500 mt-1">{question.description}</p></div>
              <RadioGroup onValueChange={(value) => handleAnswerChange(question.id, value)} className="grid grid-cols-2 gap-4 mt-4">
                <div><RadioGroupItem value="nao" id={`${question.id}-nao`} className="sr-only" /><Label htmlFor={`${question.id}-nao`} className={cn("flex flex-col items-center justify-center rounded-md border-2 p-4 text-lg font-semibold cursor-pointer transition-all", answers[question.id]?.answer === 'nao' ? "bg-red-500 border-red-600 text-white ring-2 ring-offset-2 ring-red-500" : "bg-white border-gray-300 text-red-500 hover:bg-red-50")}><ThumbsDown className="mb-2 h-7 w-7" />Não</Label></div>
                <div><RadioGroupItem value="sim" id={`${question.id}-sim`} className="sr-only" /><Label htmlFor={`${question.id}-sim`} className={cn("flex flex-col items-center justify-center rounded-md border-2 p-4 text-lg font-semibold cursor-pointer transition-all", answers[question.id]?.answer === 'sim' ? "bg-green-500 border-green-600 text-white ring-2 ring-offset-2 ring-green-500" : "bg-white border-gray-300 text-green-600 hover:bg-green-50")}><ThumbsUp className="mb-2 h-7 w-7" />Sim</Label></div>
              </RadioGroup>
              <AnimatePresence>
                {answers[question.id]?.answer === 'nao' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-6 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                      {answers[question.id]?.photos?.map((photo, photoIndex) => (
                        <div key={photoIndex} className="relative aspect-square group">
                          <Image src={URL.createObjectURL(photo)} alt={`Preview ${photoIndex + 1}`} width={100} height={100} className="w-full h-full object-cover rounded-md" />
                          <button type="button" onClick={() => handleRemovePhoto(question.id, photoIndex)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                      <button type="button" onClick={() => fileInputRef.current[question.id]?.click()} className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-300 rounded-md text-gray-500 hover:bg-gray-50 hover:border-purple-500 transition-colors"><UploadCloud className="h-8 w-8" /><span className="text-sm mt-1">Adicionar foto</span></button>
                    </div>
                    <Input id={`photo-${question.id}`} ref={(el) => { if(el) fileInputRef.current[question.id] = el; }} type="file" multiple accept="image/*" capture="environment" onChange={(e) => handlePhotoChange(question.id, e.target.files)} className="sr-only" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
          <div className="pt-6"><Button type="submit" disabled={isSubmitting} className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-4 px-6 rounded-lg text-xl transition-transform transform hover:scale-105">{isSubmitting ? <><Loader2 className="h-6 w-6 mr-3 animate-spin" /> ENVIANDO...</> : 'FINALIZAR CHECKLIST'}</Button></div>
        </form>
      </div>
      <AnimatePresence>
        {showSuccessModal && (
          <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}><DialogContent className="sm:max-w-[425px] p-6 text-center"><motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center p-4"><CheckCircle2 className="h-20 w-20 text-green-500 mb-4" /><DialogHeader><DialogTitle className="text-3xl font-bold text-gray-800">Checklist Concluído!</DialogTitle><DialogDescription className="text-gray-600 text-lg mt-2">Suas respostas foram salvas com sucesso.</DialogDescription></DialogHeader><DialogFooter className="mt-6 w-full"><Button onClick={() => window.location.reload()} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg">Concluir</Button></DialogFooter></motion.div></DialogContent></Dialog>
        )}
      </AnimatePresence>
      <audio ref={audioRef} src={SUCCESS_SOUND_URL} preload="auto" />
    </main>
  );
}