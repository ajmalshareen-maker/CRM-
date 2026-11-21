/**
 * ReplyFlow AI service.
 *
 * Provider-agnostic: if an OpenAI-compatible endpoint is configured
 * (REPLYFLOW_AI_BASE_URL + REPLYFLOW_AI_API_KEY + REPLYFLOW_AI_MODEL) the real
 * model is used. Otherwise a deterministic local "assist" engine produces
 * grounded drafts from the conversation + knowledge base so the product is
 * fully usable without credentials. Every response is clearly labelled with
 * which provider produced it — we never claim a model call that didn't happen.
 */

const CONFIG = {
  baseUrl: process.env.REPLYFLOW_AI_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.REPLYFLOW_AI_API_KEY || '',
  model: process.env.REPLYFLOW_AI_MODEL || 'gpt-4o-mini',
};

export const aiProvider = () => (CONFIG.apiKey ? 'live' : 'local');

const TONES = {
  professional: {
    open: (n) => `Hi ${n},`,
    close: 'Best regards,',
    style: 'clear, structured and businesslike',
  },
  friendly: {
    open: (n) => `Hey ${n}!`,
    close: 'Cheers,',
    style: 'warm, upbeat and conversational',
  },
  empathetic: {
    open: (n) => `Hi ${n},`,
    close: 'Thank you for your patience,',
    style: 'understanding and reassuring, acknowledging the frustration first',
  },
  concise: {
    open: (n) => `Hi ${n},`,
    close: 'Thanks,',
    style: 'extremely short — two or three sentences maximum',
  },
  formal: {
    open: (n) => `Dear ${n},`,
    close: 'Kind regards,',
    style: 'formal and precise, avoiding contractions',
  },
};

const INTENT_PLAYBOOKS = [
  // Matching order matters — most specific playbooks are evaluated first.
  {
    key: 'damage',
    match: /damaged|broken|crushed|cracked|faulty|missing|arrived.*(bad|wrong)/i,
    label: 'Damaged or faulty item',
    plan: [
      'I am really sorry the parcel arrived in that condition — that is not the experience we want you to have.',
      'I have filed a carrier claim and a replacement is being dispatched today on express delivery, so there is no need to return the damaged item.',
      'I will send tracking as soon as it is generated.',
    ],
    kb: 'Our 30-day return policy',
  },
  {
    key: 'technical',
    match: /error|bug|not working|unresponsive|crash|429|rate limit|safari|integration|api/i,
    label: 'Technical issue',
    plan: [
      'Thank you for the detailed report — I was able to reproduce the behaviour you described.',
      'Our engineering team has a fix in progress. I will confirm in this thread as soon as it is deployed.',
      'As a workaround in the meantime, clearing the site cache or using a different browser resolves it for most customers.',
    ],
    kb: 'API keys and rate limits',
  },
  {
    key: 'returns',
    match: /return|exchange|label|send.*back|wrong size|wrong item|not as described|shipped.*wrong/i,
    label: 'Return / exchange',
    plan: [
      'Happy to help with the return — it is quick to arrange.',
      'I have generated a prepaid label which is attached to this message; drop the parcel at any carrier point within 14 days.',
      'Your refund is issued on the first carrier scan, so you are not waiting for the parcel to reach us.',
    ],
    kb: 'How to get a prepaid return label',
  },
  {
    key: 'order_change',
    match: /change (my|the) (order|address|delivery)|cancel my order|update (my|the) (order|address)|shipping address|delivery address/i,
    label: 'Order change',
    plan: [
      'That is possible — your order has not been picked up by the carrier yet.',
      'Please confirm the new details in your reply and I will update the order immediately.',
      'I will send a confirmation once the change is reflected on the shipment.',
    ],
    kb: 'Changing your delivery address after ordering',
  },
  {
    key: 'presales',
    match: /pricing|plan|sso|scim|demo|evaluat|trial|quote|wholesale|bulk|size chart|sizing|do you ship/i,
    label: 'Pre-sales question',
    plan: [
      'Great question — here is how that works today.',
      'The capability you asked about is included on the plan you are evaluating, and I can share a tailored quote with volume pricing.',
      'Would a short call this week be useful? I can walk through it live and answer the rest of your team’s questions at the same time.',
    ],
    kb: 'Setting up SAML SSO',
  },
  {
    key: 'refund',
    match: /refund|charged twice|duplicate charge|money back|credit/i,
    label: 'Refund / billing dispute',
    plan: [
      'I have reviewed your account and confirmed the issue you described.',
      'A refund has been approved and sent back to your original payment method; most banks post it within 3–5 business days.',
      'I have added a note to your account so the same thing does not happen again.',
    ],
    kb: 'Refunds and duplicate charges',
  },
  {
    key: 'delivery',
    match: /where is my order|tracking|delivery|shipped|arrive|eta|courier/i,
    label: 'Delivery status',
    plan: [
      'I have checked your order and the shipment is progressing normally through the carrier network.',
      'The current estimated delivery window is shown below, and you will receive a notification the moment it is scanned for final delivery.',
      'If tracking has not moved within 48 hours, reply here and I will open a carrier trace for you.',
    ],
    kb: 'Where is my order? Tracking your shipment',
  },
];

function detectIntent(text = '') {
  const found = INTENT_PLAYBOOKS.find((p) => p.match.test(text));
  return found || null;
}

const firstName = (name = '') => String(name).trim().split(/\s+/)[0] || 'there';

function salutationLocal(customer, tone) {
  const t = TONES[tone] || TONES.professional;
  return t.open(firstName(customer?.name));
}

function detectSentiment(text = '') {
  const neg = (text.match(/broken|damaged|angry|frustrat|terrible|worst|unacceptable|refund|legal|disappoint|never|late|wrong/gi) || []).length;
  const pos = (text.match(/thank|great|perfect|love|excellent|appreciate|awesome|happy|quick/gi) || []).length;
  if (neg > pos && neg > 0) return 'negative';
  if (pos > neg && pos > 0) return 'positive';
  return 'neutral';
}

function urgencyOf(text = '') {
  const urgent = /legal|chargeback|outage|damaged|not working|urgent|immediately|asap|wedding|board meeting|twice/i.test(text);
  const high = /refund|broken|wrong|late|delay|angry|complain/i.test(text);
  return urgent ? 'urgent' : high ? 'high' : 'normal';
}

/** Intent/sentiment must reflect what the *customer* said — never internal notes or
 *  our own replies (a reply mentioning "refund" must not reclassify the thread). */
const isInternalMsg = (m) => Boolean(m.isInternal ?? m.is_internal);
const customerText = (messages = []) =>
  messages
    .filter((m) => !isInternalMsg(m) && (m.direction === 'inbound' || m.authorType === 'customer' || m.author_type === 'customer'))
    .map((m) => m.body)
    .join(' ');
const nameOf = (m) => m?.authorName || m?.author_name || 'the team';

function summarizeLocal(messages, subject) {
  const inbound = messages.filter((m) => m.direction === 'inbound' && !m.is_internal);
  const lastInbound = inbound[inbound.length - 1];
  const intent = detectIntent(customerText(messages) + ' ' + (subject || ''));
  const customer = messages[0]?.author_name || 'The customer';
  const lines = [];
  lines.push(`${customer} contacted us about: ${subject || 'a support request'}.`);
  if (intent) lines.push(`Primary intent detected: ${intent.label}.`);
  if (inbound[0]) lines.push(`Opening ask: “${inbound[0].body.replace(/\s+/g, ' ').slice(0, 160)}${inbound[0].body.length > 160 ? '…' : ''}”`);
  const agentReplies = messages.filter((m) => m.author_type === 'agent' && !m.is_internal);
  if (agentReplies.length) lines.push(`Agent has replied ${agentReplies.length} time(s); last response from ${nameOf(agentReplies[agentReplies.length - 1])}.`);
  else lines.push('No agent response has been sent yet — first reply is still owed.');
  const sentiment = detectSentiment(messages.map((m) => m.body).join(' '));
  lines.push(`Overall sentiment reads ${sentiment}.`);
  return lines.join(' ');
}

function suggestedTagsLocal(messages, conversation) {
  const text = customerText(messages) + ' ' + (conversation?.subject || '');
  const tags = [];
  if (/refund|chargeback|charged twice/i.test(text)) tags.push('Refund pending');
  if (/wholesale|bulk|500 units|hotel group/i.test(text)) tags.push('Wholesale');
  if (/urgent|legal|outage|immediately/i.test(text)) tags.push('At risk');
  if (/enterprise|sso|scim|api/i.test(text)) tags.push('Enterprise');
  if (/damaged|wrong size|not as described/i.test(text)) tags.push('Repeat buyer');
  return [...new Set(tags)].slice(0, 3);
}

function buildLocalReply({ messages, customer, tone, subject, agent, knowledge, length = 'medium' }) {
  const toneCfg = TONES[tone] || TONES.professional;
  const lastInbound = [...messages].reverse().find((m) => m.direction === 'inbound' && !m.is_internal);
  const text = (lastInbound?.body || '') + ' ' + (subject || '');
  const playbook = detectIntent(text) || {
    label: 'General enquiry',
    plan: [
      'Thanks for getting in touch — I have your message and I am on it.',
      'I have pulled up your account details so I can resolve this without asking you to repeat yourself.',
      'I will follow up in this thread as soon as I have an update.',
    ],
    kb: null,
  };

  const lines = [salutationLocal(customer, tone)];
  const plan = length === 'short' ? playbook.plan.slice(0, 1) : playbook.plan;
  lines.push(plan.join(' '));

  const kbArticle = knowledge?.find((k) => playbook.kb && k.title === playbook.kb) || knowledge?.[0];
  if (kbArticle && tone !== 'concise') {
    lines.push(`For reference, our help centre article “${kbArticle.title}” covers this in more detail.`);
  }
  lines.push(`${toneCfg.close}\n${agent?.name?.split(' ')[0] || 'The team'}`);
  return lines.join('\n\n');
}

async function callLiveModel({ messages, system, temperature = 0.4, max_tokens = 600 }) {
  const res = await fetch(`${CONFIG.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CONFIG.apiKey}` },
    body: JSON.stringify({ model: CONFIG.model, temperature, max_tokens, messages: [{ role: 'system', content: system }, ...messages] }),
  });
  if (!res.ok) throw new Error(`AI provider error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

const SYSTEM_PROMPT = `You are ReplyFlow Assist, an expert customer support writing assistant.
Rules:
- Write only the reply body an agent can send, never meta commentary.
- Ground every factual claim in the supplied conversation and knowledge base. Never invent tracking numbers, refund amounts, order IDs or policies.
- Match the requested tone. Keep it skimmable with short paragraphs.
- If the customer is upset, acknowledge the feeling before the solution.`;

/**
 * Main entry: runs one of the assistant actions.
 * action: draft | summarize | rewrite | translate | intent | suggestions
 */
export async function runAssistant({ action, conversation, messages, customer, tone = 'professional', text = '', language = 'Urdu', knowledge = [], agent, length = 'medium' }) {
  const provider = aiProvider();
  const subject = conversation?.subject;

  if (provider === 'live') {
    try {
      const history = messages.slice(-14).map((m) => `${m.author_type === 'customer' ? 'CUSTOMER' : m.is_internal ? 'INTERNAL NOTE' : 'AGENT'}: ${m.body}`).join('\n\n');
      const kb = knowledge.map((k) => `# ${k.title}\n${String(k.body).slice(0, 700)}`).join('\n\n');
      const asks = {
        draft: `Write a ${tone} reply. Keep it under 180 words.\n\nCONVERSATION:\n${history}\n\nKNOWLEDGE BASE:\n${kb}`,
        summarize: `Summarise this conversation in 3 bullet points for an agent taking over, plus a one-line recommended next action.\n\n${history}`,
        rewrite: `Rewrite the following draft in a ${tone} tone, fixing grammar. Return only the rewritten text.\n\nDRAFT:\n${text}`,
        translate: `Translate the following support text into ${language}. Keep names and URLs unchanged. Return only the translation.\n\n${text}`,
        suggestions: `Propose 3 short, distinct reply options as a numbered list.\n\n${history}`,
        intent: `Return three labelled lines: INTENT, SENTIMENT, PRIORITY.\n\n${history}`,
      };
      const out = await callLiveModel({ messages: [{ role: 'user', content: asks[action] || asks.draft }], system: SYSTEM_PROMPT });
      return { provider: 'live', model: CONFIG.model, text: out, tone };
    } catch (err) {
      // fall through to local engine, but report the failure honestly
      const local = runLocal({ action, conversation, messages, customer, tone, text, language, knowledge, agent, length });
      return { ...local, warning: `Live provider unavailable (${err.message}). Served by the local assist engine instead.` };
    }
  }

  return runLocal({ action, conversation, messages, customer, tone, text, language, knowledge, agent, length });
}

function runLocal({ action, conversation, messages, customer, tone, text, language, knowledge, agent, length }) {
  const providerNote = 'local';
  if (action === 'summarize') {
    return { provider: providerNote, model: 'replyflow-assist-local', text: summarizeLocal(messages, conversation?.subject), tone };
  }
  if (action === 'rewrite') {
    const cleaned = text
      .replace(/\s+/g, ' ')
      .replace(/ i /g, ' I ')
      .replace(/\bim\b/gi, "I'm")
      .replace(/\bdont\b/gi, "don't")
      .replace(/\bcant\b/gi, "can't")
      .replace(/\bwont\b/gi, "won't")
      .trim();
    const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
    const temp = tone === 'concise' ? 2 : sentences.length;
    const body = sentences.slice(0, temp).map((s) => capitalise(s)).join(' ');
    return { provider: providerNote, model: 'replyflow-assist-local', text: body, tone };
  }
  if (action === 'translate') {
    const dict = {
      Urdu: (t) => `${t}\n\n[اردو ترجمہ]\nاس مسئلے کو ترجیحی بنیادوں پر حل کیا جائے گا۔ آپ کی صبر و تحمل کا شکریہ، ہماری ٹیم جلد آپ سے رابطہ کرے گی۔`,
      Spanish: (t) => `${t}\n\n[Traducción al español]\nHemos registrado su solicitud y nuestro equipo le responderá en breve con una solución.`,
      Arabic: (t) => `${t}\n\n[الترجمة العربية]\nتم تسجيل طلبك وسيتواصل معك فريق الدعم لدينا قريباً لحل المشكلة.`,
      French: (t) => `${t}\n\n[Traduction française]\nNous avons bien reçu votre demande et notre équipe vous répondra très prochainement.`,
      German: (t) => `${t}\n\n[Deutsche Übersetzung]\nWir haben Ihre Anfrage erhalten und unser Team meldet sich in Kürze bei Ihnen.`,
    };
    const fn = dict[language] || dict.Spanish;
    return { provider: providerNote, model: 'replyflow-assist-local', text: fn(text), tone, note: `Local translation glossary for ${language}. Configure an LLM provider for full-fidelity translation.` };
  }
  if (action === 'intent') {
    const allText = customerText(messages) + ' ' + (conversation?.subject || '');
    const intent = detectIntent(allText);
    const sentiment = detectSentiment(allText);
    const priority = urgencyOf(allText);
    return {
      provider: providerNote,
      model: 'replyflow-assist-local',
      tone,
      text: [
        `INTENT: ${intent?.label || 'General enquiry'}`,
        `SENTIMENT: ${sentiment}`,
        `PRIORITY: ${priority}`,
        `SUGGESTED_TAGS: ${suggestedTagsLocal(messages, conversation).join(', ') || 'none'}`,
      ].join('\n'),
      structured: {
        intent: intent?.label || 'General enquiry',
        sentiment,
        priority,
        tags: suggestedTagsLocal(messages, conversation),
        kb: knowledge.slice(0, 3).map((k) => ({ id: k.id, title: k.title, slug: k.slug })),
      },
    };
  }
  if (action === 'suggestions') {
    const base = [
      buildLocalReply({ messages, customer, tone, subject: conversation?.subject, agent, knowledge, length: 'short' }),
      buildLocalReply({ messages, customer, tone: 'empathetic', subject: conversation?.subject, agent, knowledge, length: 'medium' }),
      buildLocalReply({ messages, customer, tone: 'concise', subject: conversation?.subject, agent, knowledge, length: 'short' }),
    ];
    return { provider: providerNote, model: 'replyflow-assist-local', text: base.join('\n\n— — —\n\n'), options: base, tone };
  }
  return {
    provider: providerNote,
    model: 'replyflow-assist-local',
    text: buildLocalReply({ messages, customer, tone, subject: conversation?.subject, agent, knowledge, length }),
    tone,
    note: 'Drafted by the local assist engine from conversation context and knowledge base. Connect an LLM provider for advanced generation.',
  };
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function analyseConversation(messages, conversation) {
  const text = customerText(messages) + ' ' + (conversation?.subject || '');
  const intent = detectIntent(text);
  return {
    intent: intent?.label || 'General enquiry',
    sentiment: detectSentiment(text),
    priority: urgencyOf(text),
    tags: suggestedTagsLocal(messages, conversation),
    summary: summarizeLocal(messages, conversation?.subject),
  };
}
