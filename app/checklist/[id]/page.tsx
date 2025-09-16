// app/checklist/[id]/page.tsx

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

type Checklist = {
  name: string;
};

export default async function ChecklistPage({ params }: { params: { id: string } }) {

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: checklist } = await supabase
    .from('checklists')
    .select('name')
    .eq('id', params.id)
    .single<Checklist>();

  if (!checklist) {
    notFound();
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">{checklist.name}</CardTitle>
          <CardDescription>Por favor, preencha todos os itens abaixo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-3">
                <Label htmlFor="q1">Item 1 está conforme?</Label>
                <RadioGroup defaultValue="na" className="flex space-x-4">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="sim" id="q1-sim" /><Label htmlFor="q1-sim">Sim</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="nao" id="q1-nao" /><Label htmlFor="q1-nao">Não</Label></div>
                </RadioGroup>
              </div>
              <Separator />
              <div className="flex flex-col space-y-3">
                <Label htmlFor="q2">Item 2 está conforme?</Label>
                 <RadioGroup defaultValue="na" className="flex space-x-4">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="sim" id="q2-sim" /><Label htmlFor="q2-sim">Sim</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="nao" id="q2-nao" /><Label htmlFor="q2-nao">Não</Label></div>
                </RadioGroup>
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button>Enviar Checklist</Button>
        </CardFooter>
      </Card>
    </main>
  );
}