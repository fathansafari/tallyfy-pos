export const createAIBosChat = (ctx, history) => {
  return {
    ctx,
    history
  };
};

export const sendChatMessage = async (chat, message, extraOpts) => {
  let systemInstruction = "";
  if (chat.ctx) {
    const tops = chat.ctx.topProducts?.slice(0, 3).map((p, i) => `${i + 1}. ${p.name}`).join(', ') || '-';
    systemInstruction = `You are Tallyfy AI, a helpful business assistant for ${chat.ctx.storeName}.
Today is ${chat.ctx.tanggal}.
Today's Revenue: Rp ${chat.ctx.omzet} from ${chat.ctx.trxCount} transactions.
Top Products: ${tops}.
Low Stock Items: ${chat.ctx.lowStock?.map(p => p.name).join(', ') || 'None'}.
Answer in an encouraging, concise and friendly manner, in Indonesian. Provide brief advice based on standard retail principles if requested.`;
  }

  const response = await fetch("/api/gemini/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction,
      history: chat.history, // history is managed correctly by the component!
      message
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to generate response");
  }

  const data = await response.json();
  
  // Track history manually here since we are just passing strings/objects to backend
  chat.history.push({ role: "user", parts: [{ text: message }] });
  chat.history.push({ role: "model", parts: [{ text: data.text }] });

  return data.text;
};
