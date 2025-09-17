// app/submission/[submissionId]/page.tsx
"use client"; // Define o arquivo inteiro como um Componente de Cliente

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { notFound, useParams } from 'next/navigation';
import Image from 'next/image';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { Download, ThumbsDown, ThumbsUp, Loader2, MessageSquareText } from 'lucide-react';

// --- Tipos de Dados ---
type SubmissionData = {
  created_at: string;
  answers: Record<string, { answer: string; photo_urls: string[] | null; comment?: string | null }>;
  checklists: { name: string } | null;
  users: { name: string; role: string } | null;
};

// --- Dados Mockados (para mapear IDs de perguntas para texto) ---
const MOCKED_QUESTIONS: Record<string, string> = {
  q1: 'Cintos de segurança funcionam perfeitamente?',
  q2: 'Os pneus estão em bom estado?',
  q3: 'As rodas estão em bom estado?',
};

export default function SubmissionPage() {
    const params = useParams();
    const submissionId = params.submissionId as string;

    // --- Estados da Página ---
    const [submission, setSubmission] = useState<SubmissionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [photoIndex, setPhotoIndex] = useState(0);

    // --- Cliente Supabase para o Navegador ---
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // --- Efeito para Buscar os Dados da Submissão ---
    useEffect(() => {
        if (!submissionId) return;

        async function getSubmissionData() {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('submissions')
                .select(`
                    created_at,
                    answers,
                    checklists ( name ),
                    users ( name, role )
                `)
                .eq('id', submissionId)
                .single<SubmissionData>();

            if (error || !data) {
                console.error("Erro ao buscar submissão:", error);
                notFound();
            } else {
                setSubmission(data);
            }
            setIsLoading(false);
        }
        
        getSubmissionData();
    }, [submissionId]); // Roda sempre que o ID da submissão mudar

    // --- Funções do Lightbox ---
    const allPhotos = submission 
      ? Object.values(submission.answers)
        .flatMap(answer => answer.photo_urls || [])
        .map(url => ({ src: url }))
      : [];

    const openLightbox = (photoUrl: string) => {
      const index = allPhotos.findIndex(p => p.src === photoUrl);
      if (index > -1) {
        setPhotoIndex(index);
        setLightboxOpen(true);
      }
    };

    // --- Renderização ---
    if (isLoading || !submission) {
        return (
            <main className="flex min-h-screen w-full items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <p className="ml-2 text-gray-700">Carregando revisão...</p>
            </main>
        );
    }

    return (
      <main className="min-h-screen bg-gray-100 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Cabeçalho da Página de Revisão */}
          <div className="bg-white p-6 rounded-xl shadow-md mb-6">
            <h1 className="text-3xl font-bold text-gray-800">{submission.checklists?.name}</h1>
            <div className="text-gray-500 mt-2 flex flex-col sm:flex-row sm:space-x-4">
              <span>Executor: <span className="font-semibold text-gray-700">{submission.users?.name || 'Desconhecido'}</span></span>
              <span>Data: <span className="font-semibold text-gray-700">{new Date(submission.created_at).toLocaleString('pt-BR')}</span></span>
            </div>
          </div>
  
          {/* Lista de Respostas */}
          <div className="space-y-4">
            {Object.entries(submission.answers).map(([qid, answer]) => (
              <div key={qid} className="bg-white p-5 rounded-lg shadow-sm border">
                <p className="font-semibold text-gray-700">{MOCKED_QUESTIONS[qid] || 'Pergunta desconhecida'}</p>
                <div className={`mt-2 flex items-center gap-2 font-bold ${answer.answer === 'sim' ? 'text-green-600' : 'text-red-600'}`}>
                  {answer.answer === 'sim' ? <ThumbsUp size={20} /> : <ThumbsDown size={20} />}
                  <span>{answer.answer === 'sim' ? 'Sim' : 'Não'}</span>
                </div>
                
                {/* Bloco para exibir o comentário, se existir */}
                {answer.comment && (
                    <div className="mt-4 pt-4 border-t border-dashed">
                        <p className="text-sm font-semibold text-gray-600 mb-1 flex items-center gap-2">
                          <MessageSquareText size={16} /> Comentário do executor:
                        </p>
                        <p className="text-gray-800 bg-gray-50 p-3 rounded-md whitespace-pre-wrap">{answer.comment}</p>
                    </div>
                )}

                {/* Bloco para exibir as fotos, se existirem */}
                {answer.photo_urls && answer.photo_urls.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-semibold text-gray-600 mb-2">Fotos de Evidência:</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                      {answer.photo_urls.map((url: string, index: number) => (
                        <div key={index} className="relative group">
                          <Image
                            src={url}
                            alt={`Evidência ${index + 1}`}
                            width={150}
                            height={150}
                            className="rounded-md object-cover aspect-square cursor-pointer transition-transform hover:scale-105"
                            onClick={() => openLightbox(url)}
                          />
                           <a href={`${url}?download=true`} target="_blank" rel="noopener noreferrer" className="absolute bottom-1 right-1 bg-black/50 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity" title="Baixar imagem">
                             <Download size={16} />
                           </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
    
          {/* Componente Lightbox para zoom nas imagens */}
          <Lightbox
            open={lightboxOpen}
            close={() => setLightboxOpen(false)}
            slides={allPhotos}
            index={photoIndex}
          />
        </div>
      </main>
    );
}