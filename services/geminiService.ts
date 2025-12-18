
import { GoogleGenAI, Type } from "@google/genai";
import { TimeLog, AnalysisResult, AppSettings } from "../types";

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API Key not found");
    }
    return new GoogleGenAI({ apiKey });
}

// Helper auxiliar para calcular duração legível
const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let readableDuration = [];
    if (hours > 0) readableDuration.push(`${hours} horas`);
    if (minutes > 0) readableDuration.push(`${minutes} minutos`);
    if (seconds > 0 || (hours === 0 && minutes === 0)) readableDuration.push(`${seconds} segundos`);
    
    return readableDuration.join(' e ');
};

// CÁLCULO MATEMÁTICO RIGOROSO DE HORAS NOTURNAS (22:00 - 07:00)
// Duplicado da lógica do App para garantir consistência absoluta nos dados enviados à IA
const calculateNightShiftMs = (log: TimeLog) => {
    if (!log.startTime) return 0;
    const start = new Date(log.startTime);
    const end = log.endTime ? new Date(log.endTime) : new Date();

    const getOverlap = (start1: number, end1: number, start2: number, end2: number) => {
        const maxStart = Math.max(start1, start2);
        const minEnd = Math.min(end1, end2);
        return Math.max(0, minEnd - maxStart);
    };

    let nightMs = 0;
    const sTime = start.getTime();
    const eTime = end.getTime();

    // Janelas de verificação (Ontem, Hoje, Amanhã)
    const windows = [];
    const currentScanner = new Date(start);
    currentScanner.setDate(currentScanner.getDate() - 1);
    const endScanner = new Date(end);
    endScanner.setDate(endScanner.getDate() + 1);

    while (currentScanner <= endScanner) {
        const wStart = new Date(currentScanner);
        wStart.setHours(22, 0, 0, 0);
        const wEnd = new Date(currentScanner);
        wEnd.setDate(wEnd.getDate() + 1);
        wEnd.setHours(7, 0, 0, 0);
        
        windows.push({ start: wStart.getTime(), end: wEnd.getTime() });
        currentScanner.setDate(currentScanner.getDate() + 1);
    }

    windows.forEach(win => {
        const intersection = getOverlap(sTime, eTime, win.start, win.end);
        if (intersection > 0) {
            let effectiveNightWork = intersection;
            const overlapStart = Math.max(sTime, win.start);
            const overlapEnd = Math.min(eTime, win.end);

            // Abater pausas que ocorreram DURANTE o horário noturno
            log.breaks.forEach(brk => {
                if (brk.type === 'LUNCH') {
                     const bStart = new Date(brk.startTime).getTime();
                     const bEnd = brk.endTime ? new Date(brk.endTime).getTime() : new Date().getTime();
                     const breakInNight = getOverlap(bStart, bEnd, overlapStart, overlapEnd);
                     effectiveNightWork -= breakInNight;
                }
            });
            nightMs += Math.max(0, effectiveNightWork);
        }
    });

    return nightMs;
};

export const analyzeTimesheet = async (logs: TimeLog[], settings: AppSettings): Promise<AnalysisResult> => {
  const ai = getClient();
  
  // Prepare data for the model
  const logSummary = logs.map(log => {
    const breakDetails = log.breaks.map(b => 
        `${b.type === 'COFFEE' ? 'Café' : 'Almoço'} (${new Date(b.startTime).toLocaleTimeString('pt-BR')} - ${b.endTime ? new Date(b.endTime).toLocaleTimeString('pt-BR') : '...'})`
    ).join(', ');

    const absenceDetails = log.absences ? log.absences.map(a => 
        a.type === 'FULL_DAY' ? `Falta (Dia todo): ${a.reason}` : `Falta Parcial (${a.startTime}-${a.endTime}): ${a.reason}`
    ).join('; ') : '';

    const durationText = formatDuration(log.totalDurationMs);
    
    // Cálculo Matemático Prévio
    const nightMs = calculateNightShiftMs(log);
    const nightDurationText = formatDuration(nightMs);
    
    // Identificar feriados para informar a IA explicitamente
    const allHolidays = settings.holidays || [];
    const isHoliday = allHolidays.includes(log.date);

    return {
        date: new Date(log.startTime).toISOString().split('T')[0],
        weekDay: new Date(log.startTime).toLocaleDateString('pt-BR', { weekday: 'long' }),
        start: new Date(log.startTime).toLocaleTimeString('pt-BR'),
        end: log.endTime ? new Date(log.endTime).toLocaleTimeString('pt-BR') : 'Em andamento',
        breaks: breakDetails || 'Sem pausas',
        absences: absenceDetails || 'Sem ausências',
        
        // Dados Calculados (A verdade absoluta para a IA)
        totalWorkedText: durationText,
        isHoliday: isHoliday,
        
        // DADOS NOTURNOS PRÉ-CALCULADOS
        calculatedNightHours: nightDurationText, 
        nightMs: nightMs,
        hasNightShift: nightMs > 0
    };
  });

  const currencySymbol = settings.currency || 'EUR';
  
  const prompt = `
    Atue como um especialista em RH e Legislação Trabalhista (Foco em Portugal). Analise os registros de ponto JSON abaixo.
    
    DADOS DE ENTRADA (JÁ CALCULADOS PELO SISTEMA):
    ${JSON.stringify(logSummary)}

    CONFIGURAÇÕES:
    - Jornada Padrão: ${settings.dailyWorkHours} horas.
    - Valor Hora Base: ${currencySymbol} ${settings.hourlyRate || 0}.

    REGRAS CRÍTICAS DE CÁLCULO (IMPORTANTE):

    1. HORAS SUPLEMENTARES (EXTRAS) EM DIAS ÚTEIS:
       - 1ª Hora Extra: Paga com acréscimo de 25%.
       - Horas Extras Seguintes: Pagas com acréscimo de 37.5%.
       
    2. FIM DE SEMANA OU FERIADOS:
       - Todas as horas trabalhadas (normais ou extras) recebem acréscimo de 100% (Valor Dobrado).
       
    3. ADICIONAL NOTURNO (22:00 às 07:00) - REGRA ACUMULATIVA:
       - O sistema JÁ CALCULOU matematicamente o tempo noturno exato (calculatedNightHours).
       - O Adicional Noturno é de 25% sobre a hora base.
       - Ele ACUMULA com as horas extras. 
       - Exemplo: Se fizer hora extra à noite, recebe o valor da hora extra (+25% ou +37.5%) MAIS o adicional noturno (+25%).
       
    4. VALE REFEIÇÃO:
       - Mencione se foi creditado, mas NÃO some ao valor da "hora trabalhada" ou "ganho extra". É um benefício à parte.

    INSTRUÇÕES PARA O RESUMO:
    - Confie EXCLUSIVAMENTE nos valores calculados de "totalWorkedText" e "calculatedNightHours" fornecidos no JSON.
    - Se houve Horas Extras, explique o cálculo (1ª hora a 25%, resto a 37.5% em dias úteis).
    - Se houve Adicional Noturno, mencione separadamente o ganho adicional por isso (25% acumulativo).
    - Seja financeiramente preciso.

    Gere um JSON de resposta.
  `;

  try {
    const response = await ai.models.generateContent({
      // Using gemini-3-pro-preview for advanced HR reasoning task
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingBudget: 1024,
        },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Resumo financeiro detalhado explicando as regras de 25%/37.5% e adicional noturno." },
            overtime: { type: Type.BOOLEAN, description: "True se trabalhou mais que a jornada diária." },
            mood: { type: Type.STRING, enum: ["positive", "neutral", "warning"] },
            suggestions: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Dicas curtas."
            }
          }
        }
      }
    });

    if (response.text) {
        return JSON.parse(response.text) as AnalysisResult;
    }
    throw new Error("No data returned");

  } catch (error) {
    console.error("Error analyzing timesheet:", error);
    return {
      summary: "Não foi possível analisar os dados no momento.",
      overtime: false,
      mood: 'neutral',
      suggestions: []
    };
  }
};
