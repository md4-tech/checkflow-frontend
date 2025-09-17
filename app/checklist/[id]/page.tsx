// app/checklist/[id]/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { notFound, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion'; // Para animações!
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'; // Ícones modernos

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
} from "@/components/ui/dialog"; // Para o modal de sucesso

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

// Perguntas mockadas para demonstração
const MOCKED_QUESTIONS = [
  { id: 'q1', text: 'Limpeza do ambiente está adequada?' },
  { id: 'q2', text: 'Equipamento X está funcionando corretamente?' },
  { id: 'q3', text: 'Estoque do produto Y está em nível seguro?' },
  { id: 'q4', text: 'Documentação de segurança preenchida?' },
];

export default function ChecklistPage() {
  const params = useParams();
  const checklistId = params.id as string;

  // --- Estados da Aplicação ---
  const [checklist, setChecklist] = useState<ChecklistData | null>(null);
  const [executor, setExecutor] = useState<UserData | null>(null); // Dados do executor
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
      
      // Busca o checklist e o assigned_user_id
      const { data: checklistData, error: checklistError } = await supabase
        .from('checklists')
        .select('name, assigned_user_id') 
        .eq('id', checklistId)
        .single<ChecklistData>();
      
      if (checklistError || !checklistData) {
        console.error("Erro ao buscar checklist:", checklistError);
        notFound();
        return;
      }
      setChecklist(checklistData);

      // Busca os dados do executor (nome, cargo)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('name, role')
        .eq('id', checklistData.assigned_user_id)
        .single<UserData>();

      if (userError || !userData) {
        console.error("Erro ao buscar executor:", userError);
        // Não impede o carregamento, mas o nome do executor não aparecerá
      } else {
        setExecutor(userData);
      }
      setIsLoading(false);
    }
    fetchData();
  }, [checklistId]);

  // --- Handlers de Mudança ---
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

    // Validação de fotos
    for (const q of MOCKED_QUESTIONS) {
      if (answers[q.id]?.answer === 'nao' && !answers[q.id]?.photo) {
        alert(`Por favor, anexe uma foto para a pergunta: "${q.text}"`);
        return;
      }
    }

    setIsSubmitting(true);
    const finalAnswers: Record<string, { answer: string; photo_url: string | null }> = {};
    let hasNonCompliance = false;

    // Upload de fotos
    for (const questionId in answers) {
      const currentAnswer = answers[questionId];
      finalAnswers[questionId] = { answer: currentAnswer.answer, photo_url: null };

      if (currentAnswer.answer === 'nao') {
        hasNonCompliance = true;
        if (currentAnswer.photo) {
          const photo = currentAnswer.photo;
          const filePath = `public/${checklistId}/${questionId}-${Date.now()}-${photo.name}`; // Melhor organização de pastas
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('checklist-photos')
            .upload(filePath, photo);

          if (uploadError) {
            alert(`Erro no upload da foto para a pergunta ${questionId}. Tente novamente.`);
            console.error("Erro no upload:", uploadError);
            setIsSubmitting(false);
            return;
          }

          const { data: publicUrlData } = supabase.storage
            .from('checklist-photos')
            .getPublicUrl(uploadData.path);
          
          finalAnswers[questionId].photo_url = publicUrlData.publicUrl;
        }
      }
    }

    // Inserção na tabela submissions
    const { error: insertError } = await supabase.from('submissions').insert({
      checklist_id: checklistId,
      executor_id: checklist.assigned_user_id,
      answers: finalAnswers,
      has_non_compliance: hasNonCompliance,
    });

    if (insertError) {
      alert("Ocorreu um erro ao salvar o checklist. Tente novamente.");
      console.error("Erro ao inserir submissão:", insertError);
    } else {
      setShowSuccessModal(true);
      if (audioRef.current) {
        audioRef.current.play(); // Toca o som de sucesso
      }
    }

    setIsSubmitting(false);
  };

  // --- Renderização Condicional ---
  if (isLoading) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-gray-50 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="ml-2 text-gray-700">Carregando checklist...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <Card className="w-full max-w-xl shadow-lg rounded-xl overflow-hidden animate-fade-in">
        <form onSubmit={handleSubmit}>
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6">
            <CardTitle className="text-3xl font-bold tracking-tight">{checklist?.name}</CardTitle>
            <CardDescription className="text-blue-100 mt-1">
              Preencha os itens abaixo. {executor && `Responsável: ${executor.name} (${executor.role})`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            {MOCKED_QUESTIONS.map((question, index) => (
              <motion.div 
                key={question.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="bg-white p-5 rounded-lg shadow-sm border border-gray-200"
              >
                <div className="flex flex-col space-y-4">
                  <Label className="text-lg font-medium text-gray-800">{question.text}</Label>
                  <RadioGroup 
                    onValueChange={(value) => handleAnswerChange(question.id, value)} 
                    className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sim" id={`${question.id}-sim`} />
                      <Label htmlFor={`${question.id}-sim`} className="text-gray-700">Sim</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nao" id={`${question.id}-nao`} />
                      <Label htmlFor={`${question.id}-nao`} className="text-gray-700">Não</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                {answers[question.id]?.answer === 'nao' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-6 pt-4 border-t border-red-200 flex flex-col space-y-3"
                  >
                    <Label htmlFor={`photo-${question.id}`} className="text-base font-semibold text-red-700 flex items-center">
                      <XCircle className="h-5 w-5 mr-2 text-red-500" /> Anexar Foto (Obrigatório)
                    </Label>
                    <Input 
                      id={`photo-${question.id}`} 
                      type="file" 
                      required 
                      accept="image/*" // Limita para imagens
                      capture="environment" // Sugere câmera traseira em mobile
                      onChange={(e) => handlePhotoChange(question.id, e.target.files ? e.target.files[0] : null)} 
                      className="border-red-300 focus:border-red-500"
                    />
                  </motion.div>
                )}

                {index < MOCKED_QUESTIONS.length - 1 && <Separator className="mt-8 bg-gray-200" />}
              </motion.div>
            ))}
          </CardContent>
          <CardFooter className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out text-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Enviando...
                </>
              ) : (
                'Enviar Checklist'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Modal de Sucesso */}
      <AnimatePresence>
        {showSuccessModal && (
          <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
            <DialogContent className="sm:max-w-[425px] p-6 text-center rounded-lg shadow-xl animate-fade-in-scale">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="flex flex-col items-center justify-center p-4"
              >
                <CheckCircle2 className="h-20 w-20 text-green-500 mb-4 animate-bounce-in" />
                <DialogHeader>
                  <DialogTitle className="text-3xl font-bold text-gray-800 mb-2">Checklist Concluído!</DialogTitle>
                  <DialogDescription className="text-gray-600 text-lg">
                    Suas respostas foram salvas com sucesso.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-6 w-full">
                  <Button 
                    onClick={() => {
                      setShowSuccessModal(false);
                      // Você pode adicionar um redirecionamento ou resetar o formulário aqui
                      window.location.reload(); // Recarrega a página para novo preenchimento
                    }} 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg"
                  >
                    Novo Checklist
                  </Button>
                </DialogFooter>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Áudio para o som de sucesso */}
      <audio ref={audioRef} src={SUCCESS_SOUND_URL} preload="auto" />
    </main>
  );
}