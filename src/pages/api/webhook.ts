import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// 1. Inicializa el cliente con la KEY DE SERVIDOR (Service Role)
// IMPORTANTE: Esta llave debe estar en tu .env como SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { eventType, account, amount } = req.body;

  if (!account || !eventType) {
    return res.status(400).json({ error: 'Missing account or eventType' });
  }

  // 2. Si es una transferencia de entrada, registramos el evento
  if (eventType === 'transfer') {
    try {
      // Usamos el cliente con service_role para insertar ignorando RLS
      const { data, error } = await supabase
        .from('pending_actions')
        .insert([
          { 
            wallet_address: account, 
            action: 'swap_sol_to_usdc', 
            status: 'pending',
            amount: amount || '1000000000'
          }
        ]);

      if (error) throw error;

      return res.status(200).json({ message: 'Evento guardado exitosamente' });
    } catch (e) {
      console.error('Error en webhook:', e);
      return res.status(500).json({ error: 'Error interno de base de datos' });
    }
  }

  return res.status(200).json({ message: 'Evento ignorado' });
}