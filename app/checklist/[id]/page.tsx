// app/checklist/[id]/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { notFound, useParams } from 'next/navigation';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Input } from '@/components/ui/input';

// MUDANÇA: O tipo agora inclui o ID do executor
type ChecklistData = {
  name: string;
  assigned_user_id: string; 
};

const MOCKED_QUESTIONS = [
  { id: 'q1', text: 'Item 1 está conforme?' },
  { id: 'q2', text: 'Item 2 está conforme?' },
];

export default function ChecklistPage() {
  const params = useParams();
  const checklistId = params.id as string;

  const [checklist, setChecklist] = useState<ChecklistData | null>(null);
  const [answers, setAnswers] = useState<Record<string, { answer: string; photo?: File | null }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // O executorId agora virá dos dados do checklist
  // const [executorId, setExecutorId] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function getChecklist() {
      // MUDANÇA: Buscamos o nome E o ID do usuário atribuído
      const { data, error } = await supabase
        .from('checklists')
        .select('name, assigned_user_id') 
        .eq('id', checklistId)
        .single<ChecklistData>();

      if (error || !data) { notFound(); } 
      else { setChecklist(data); }
      setIsLoading(false);
    }
    getChecklist();
  }, [checklistId]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], answer: value } }));
  };

  const handlePhotoChange = (questionId: string, file: File | null) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], photo: file } }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || !checklist?.assigned_user_id) return; // Trava de segurança

    for (const q of MOCKED_QUESTIONS) {
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
          const filePath = `public/${checklistId}-${questionId}-${Date.now()}-${photo.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage.from('checklist-photos').upload(filePath, photo);
          if (uploadError) {
            alert(`Erro no upload da foto para a pergunta ${questionId}. Tente novamente.`);
            setIsSubmitting(false);
            return;
          }
          const { data: publicUrlData } = supabase.storage.from('checklist-photos').getPublicUrl(uploadData.path);
          finalAnswers[questionId].photo_url = publicUrlData.publicUrl;
        }
      }
    }

    // MUDANÇA: Usamos o executor_id que veio do banco de dados
    const { error: insertError } = await supabase.from('submissions').insert({
      checklist_id: checklistId,
      executor_id: checklist.assigned_user_id,
      answers: finalAnswers,
      has_non_compliance: hasNonCompliance,
    });

    if (insertError) {
      alert("Ocorreu um erro ao salvar o checklist. Tente novamente.");
      console.error(insertError);
    } else {
      alert("Checklist enviado com sucesso!");
    }

    setIsSubmitting(false);
  };

  if (isLoading) {
    return <main className="flex min-h-screen w-full items-center justify-center"><p>Carregando checklist...</p></main>;
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-lg">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="text-2xl">{checklist?.name}</CardTitle>
            <CardDescription>Por favor, preencha todos os itens abaixo.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid w-full items-center gap-6">
              {MOCKED_QUESTIONS.map((question, index) => (
                <div key={question.id}>
                  <div className="flex flex-col space-y-3">
                    <Label>{question.text}</Label>
                    <RadioGroup onValueChange={(value) => handleAnswerChange(question.id, value)} className="flex space-x-4">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="sim" id={`${question.id}-sim`} /><Label htmlFor={`${question.id}-sim`}>Sim</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="nao" id={`${question.id}-nao`} /><Label htmlFor={`${question.id}-nao`}>Não</Label></div>
                    </RadioGroup>
                  </div>
                  {answers[question.id]?.answer === 'nao' && (
                    <div className="mt-4 flex flex-col space-y-2">
                       <Label htmlFor={`photo-${question.id}`} className="text-sm text-red-600">Anexar Foto (Obrigatório)</Label>
                       <Input id={`photo-${question.id}`} type="file" required onChange={(e) => handlePhotoChange(question.id, e.target.files ? e.target.files[0] : null)} />
                    </div>
                  )}
                  {index < MOCKED_QUESTIONS.length - 1 && <Separator className="mt-6" />}
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Enviar Checklist'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}