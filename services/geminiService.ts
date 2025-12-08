import { GoogleGenAI, Type } from "@google/genai";
import { TimeLog, AnalysisResult, AppSettings } from "../types";

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API Key não encontrada. Configure a variável de ambiente API_KEY.");
    }
    return new GoogleGenAI({ apiKey });
}

export const analyzeTimesheet = async (logs: TimeLog[], settings: AppSettings): Promise<AnalysisResult> => {
  try {
    const ai = getClient();
  
    // Prepare data for the model
    const logSummary = logs.map(log => {
      const breakDetails = log.breaks.map(b => 
          `${b.type === 'COFFEE' ? 'Café' : 'Almoço'} (${new Date(b.startTime).toLocaleTimeString('pt-BR')} - ${b.endTime ? new Date(b.endTime).toLocaleTimeString('pt-BR') : '...'})`
      ).join(', ');

      const absenceDetails = log.absences ? log.absences.map(a => 
          a.type === 'FULL_DAY' ? `Falta (Dia todo): ${a.reason}` : `Falta Parcial (${a.startTime}-${a.endTime}): ${a.reason}`
      ).join('; ') : '';

      // Formatação legível do tempo (ex: 26 segundos, 1 hora e 30 minutos)
      const totalSeconds = Math.floor(log.totalDurationMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      let readableDuration = [];
      if (hours > 0) readableDuration.push(`${hours} horas`);
      if (minutes > 0) readableDuration.push(`${minutes} minutos`);
      if (seconds > 0 || (hours === 0 && minutes === 0)) readableDuration.push(`${seconds} segundos`);
      
      const durationText = readableDuration.join(' e ');

      return {
          date: new Date(log.startTime).toISOString().split('T')[0], // Enviar formato YYYY-MM-DD para comparação exata
          start: new Date(log.startTime).toLocaleTimeString('pt-BR'),
          breaks: breakDetails || 'Sem pausas',
          absences: absenceDetails || 'Sem ausências',
          end: log.endTime ? new Date(log.endTime).toLocaleTimeString('pt-BR') : 'Em andamento',
          // Enviamos tanto o decimal para calculo de valor, quanto o texto para exibição
          decimalHours: (log.totalDurationMs / (1000 * 60 * 60)).toFixed(4),
          formattedDuration: durationText
      };
    });

    const currencySymbol = settings.currency || 'EUR';
    const holidaysList = (settings.holidays || []).join(', ');

    const prompt = `
      Analise os seguintes registros de ponto de um funcionário (formato JSON abaixo).
      
      Regras de Negócio RÍGIDAS (Legislação Portuguesa + Padrão do App):
      1. Jornada Diária Padrão: ${settings.dailyWorkHours} horas (exceto em dias especiais de hora extra).
      2. NÃO EXISTE BANCO DE HORAS. Cada dia é analisado individualmente.
      3. Intervalo de Almoço (LUNCH) é descontado da jornada. Pausa do Café (COFFEE) conta como trabalho (não desconta).
      4. O valor hora base é ${currencySymbol} ${settings.hourlyRate || 0}.

      5. REGRA DE HORAS EXTRAS (IMPORTANTE):
         - Horas Suplementares (Dias Úteis Excedentes): O bônus é de ${settings.overtimePercentage || 0}%. Regra: Tudo que ultrapassar ${settings.dailyWorkHours} horas em um dia comum.
         - DIAS ESPECIAIS (FERIADOS E FIM DE SEMANA): 
           **Verifique OBRIGATORIAMENTE se a data do log está na lista de Feriados: [${holidaysList}]**
           Ou se é um dia de fim de semana/extra configurado: [${(settings.overtimeDays || []).join(', ')}] (Dom=0, Sáb=6).
           
           SE FOR FERIADO OU DIA ESPECIAL:
           - O bônus é de 100% (valor dobra) SOBRE TODAS AS HORAS TRABALHADAS NO DIA. 
           - Não existe "jornada padrão" nestes dias, toda hora conta como Hora Extra 100%.
           - Exemplo: Se trabalhou 2 horas no feriado, recebe 2 horas com valor dobrado.
      
      6. REGRA ADICIONAL NOTURNO (IMPORTANTE):
         - Horas trabalhadas entre 22:00 e 07:00 da manhã do dia seguinte recebem um adicional de 25%.
         - Verifique se os horários de entrada/saída caem nesse intervalo.
         - Se houver trabalho noturno, mencione explicitamente e valorize o ganho extra.

      Informação sobre Ausências/Faltas:
      - O campo "absences" contém justificativas para não estar trabalhando.
      - Se houver uma ausência justificada (ex: Médico), leve isso em conta antes de dizer que ele "não cumpriu a meta". Seja empático.
      - Se for "Dia todo", o tempo trabalhado será 0, mas verifique se há motivo.
      
      Instruções de Análise:
      - Ao citar a duração trabalhada no resumo, USE OBRIGATORIAMENTE o texto do campo "formattedDuration" (ex: "26 segundos", "8 horas e 10 minutos"). NÃO use o valor decimal (ex: 0.01 horas).
      - Se houver horas extras, calcule o valor monetário do bônus.
      - Se houver horas noturnas (22h-07h), mencione o bônus de 25% obtido.
      - O tom deve ser profissional e direto.
      - Se a meta não foi atingida, aponte como "Débito de horas" no dia, a menos que justificado por ausência.
      
      Gere um relatório JSON:
      Dados: ${JSON.stringify(logSummary)}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingBudget: 1024,
        },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Resumo focado no cumprimento da meta e ganhos (extras + noturno), usando formato de tempo humanizado. Mencione ausências justificadas." },
            overtime: { type: Type.BOOLEAN, description: "Verdadeiro APENAS se ultrapassou a jornada diária." },
            mood: { type: Type.STRING, enum: ["positive", "neutral", "warning"], description: "Positive se fez horas extras ou cumpriu a meta exata. Warning se ficou devendo horas não justificadas." },
            suggestions: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Dicas objetivas."
            }
          }
        }
      }
    });

    if (response.text) {
        return JSON.parse(response.text) as AnalysisResult;
    }
    throw new Error("No data returned");

  } catch (error: any) {
    console.error("Error analyzing timesheet:", error);
    
    let errorMsg = "Não foi possível analisar os dados no momento. Verifique sua conexão.";
    if (error.message && (error.message.includes("API Key") || error.message.includes("API_KEY"))) {
        errorMsg = "Chave da API não configurada corretamente.";
    }

    // Fallback mock response in case of error
    return {
      summary: errorMsg,
      overtime: false,
      mood: 'warning',
      suggestions: ["Verifique as configurações da API.", "Tente novamente mais tarde."]
    };
  }
};
