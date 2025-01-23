import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Invoice = Database['public']['Tables']['invoices']['Row'];

export const checkITCEligibility = async (invoice: Invoice) => {
  if (!invoice?.invoice_number || !invoice?.supplier_gstin) {
    throw new Error('Invalid invoice data provided');
  }

  try {
    // Only check GSTR-2B data for eligibility
    const { data: gstr2b, error: gstr2bError } = await supabase
      .from('gstr_2b')
      .select('*')
      .eq('invoice_number', invoice.invoice_number)
      .eq('supplier_gstin', invoice.supplier_gstin)
      .maybeSingle();

    if (gstr2bError) throw new Error('Error fetching GSTR-2B data');

    const isEligible = !!gstr2b;
    const verificationStatus = gstr2b ? 'VERIFIED' : 'NOT_FOUND';

    return {
      isEligible,
      verificationStatus,
      eligibleAmount: isEligible ? 
        Number(invoice.cgst) + Number(invoice.sgst) + Number(invoice.igst) : 0,
      reasons: isEligible ? [] : ['Invoice not found in GSTR-2B']
    };
  } catch (error) {
    console.error('ITC Eligibility Error:', error);
    throw error;
  }
};