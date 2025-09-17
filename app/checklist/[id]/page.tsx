// app/checklist/[id]/page.tsx
"use client"; // <-- MUITO IMPORTANTE! Torna o componente interativo.

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { notFound, useParams } from 'next/navigation';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Input } from '@/components/ui/input'; // Vamos precisar do Input para a foto

type Checklist = {
  name: string;
};

// Como agora é um Componente de Cliente, a busca de dados muda um pouco.
export default function ChecklistPage() {
  const params = useParams();
  const id = params.id as string;

  // Estados para controlar nosso formulário
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Criamos o cliente Supabase que pode ser usado no navegador
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Efeito para buscar os dados do checklist quando a página carrega
  useEffect(() => {
    async function getChecklist() {
      const { data, error } = await supabase
        .from('checklists')
        .select('name')
        .eq('id', id)
        .single<Checklist>();

      if (error || !data) {
        notFound();
      } else {
        setChecklist(data);
      }
      setIsLoading(false);
    }
    getChecklist();
  }, [id]);

  // Função para atualizar as respostas no estado
  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  // Lógica para verificar se a foto é necessária
  const requiresPhoto = Object.values(answers).includes('nao');

  // Função chamada ao clicar em "Enviar"
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    // Validação: se precisa de foto e não tem, exibe um alerta.
    if (requiresPhoto && !photo) {
      alert("Por favor, anexe uma foto como evidência da não conformidade.");
      return;
    }

    setIsSubmitting(true);
    let photoUrl = null;

    // 1. Se houver foto, faz o upload para o Storage
    if (photo) {
      const filePath = `public/${id}-${Date.now()}-${photo.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('checklist-photos')
        .upload(filePath, photo);

      if (uploadError) {
        console.error("Erro no upload da foto:", uploadError);
        alert("Ocorreu um erro ao enviar a foto. Tente novamente.");
        setIsSubmitting(false);
        return;
      }

      // 2. Pega a URL pública da foto enviada
      const { data: publicUrlData } = supabase.storage
        .from('checklist-photos')
        .getPublicUrl(uploadData.path);
      
      photoUrl = publicUrlData.publicUrl;
    }

    // 3. Insere os dados na tabela 'submissions'
    const { error: insertError } = await supabase.from('submissions').insert({
      checklist_id: id,
      answers: answers,
      has_non_compliance: requiresPhoto,
      non_compliance_photo_url: photoUrl,
    });

    if (insertError) {
      console.error("Erro ao salvar a submissão:", insertError);
      alert("Ocorreu um erro ao salvar o checklist. Tente novamente.");
    } else {
      alert("Checklist enviado com sucesso!");
      // Aqui você poderia redirecionar o usuário para uma página de "obrigado"
      // window.location.href = '/obrigado';
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
            <div className="grid w-full items-center gap-4">
              
              {/* Pergunta 1 (Exemplo) */}
              <div className="flex flex-col space-y-3">
                <Label>Item 1 está conforme?</Label>
                <RadioGroup onValueChange={(value) => handleAnswerChange('q1', value)} className="flex space-x-4">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="sim" id="q1-sim" /><Label htmlFor="q1-sim">Sim</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="nao" id="q1-nao" /><Label htmlFor="q1-nao">Não</Label></div>
                </RadioGroup>
              </div>

              <Separator />

              {/* Pergunta 2 (Exemplo) */}
              <div className="flex flex-col space-y-3">
                <Label>Item 2 está conforme?</Label>
                <RadioGroup onValueChange={(value) => handleAnswerChange('q2', value)} className="flex space-x-4">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="sim" id="q2-sim" /><Label htmlFor="q2-sim">Sim</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="nao" id="q2-nao" /><Label htmlFor="q2-nao">Não</Label></div>
                </RadioGroup>
              </div>

              {/* Campo de Foto Condicional */}
              {requiresPhoto && (
                <>
                  <Separator />
                  <div className="flex flex-col space-y-3">
                    <Label htmlFor="picture">Anexar Foto de Evidência (Obrigatório)</Label>
                    <Input id="picture" type="file" required onChange={(e) => setPhoto(e.target.files ? e.target.files[0] : null)} />
                  </div>
                </>
              )}

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