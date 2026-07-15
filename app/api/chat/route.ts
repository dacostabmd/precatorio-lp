import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY não está configurada no .env' },
        { status: 500 }
      );
    }

    const apiUrl = 'https://api.openai.com/v1/chat/completions';

    // Injeta um prompt de sistema para dar contexto ao assistente (se não existir)
    if (messages.length > 0 && messages[0].role !== 'system') {
      messages.unshift({
        role: 'system',
        content: 'Você é um assistente virtual inteligente da Premium Office Precatório. Seja educado, conciso e auxilie o usuário com suas dúvidas sobre antecipação de precatórios.'
      });
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ 
        model: 'gpt-4o-mini', // Usando um modelo rápido e barato da OpenAI
        messages 
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro na API externa: ${response.status}`);
    }

    const data = await response.json();
    
    // Ajuste aqui conforme a estrutura da sua API. 
    // Estamos tentando extrair os campos mais comuns (text, message, response ou a resposta do OpenAI/Anthropic)
    const aiText = 
      data.text || 
      data.message || 
      data.response || 
      data.choices?.[0]?.message?.content || 
      "A API retornou sucesso, mas não foi possível encontrar o texto da resposta na estrutura do JSON.";

    return NextResponse.json({ text: aiText });

  } catch (error: any) {
    console.error('Erro na rota /api/chat:', error);
    return NextResponse.json(
      { error: 'Falha ao comunicar com a IA' },
      { status: 500 }
    );
  }
}
