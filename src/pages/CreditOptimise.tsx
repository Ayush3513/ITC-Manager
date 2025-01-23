import React from "react";
import MainLayout from "@/components/Layout/MainLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, TrendingUp, CheckCircle } from "lucide-react";

interface CreditUtilization {
  id: string;
  user_id: string;
  cgst: number;
  sgst: number;
  igst: number;
  created_at: string;
}

export default function CreditOptimise() {
  const { data: credits, isLoading } = useQuery({
    queryKey: ['credit-optimization'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get credit utilization
      const { data: creditData, error: creditError } = await supabase
        .from('credit_utilization')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (creditError) throw creditError;

      // Get ITC claims
      const { data: itcData, error: itcError } = await supabase
        .from('itc_claims')
        .select('amount, eligible_amount, status')
        .eq('user_id', user.id);

      if (itcError) throw itcError;

      return {
        credits: creditData[0],
        history: creditData,
        claims: itcData
      };
    }
  });

  const getOptimizationSuggestions = () => {
    if (!credits?.credits) return [];
    
    const suggestions = [];
    const { cgst, sgst, igst } = credits.credits;

    // CGST-SGST Balance Check
    if (Math.abs(cgst - sgst) > 1000) {
      suggestions.push({
        type: 'Balance CGST-SGST',
        severity: 'warning',
        message: `There's a ${Math.abs(cgst - sgst).toLocaleString()} difference between CGST and SGST credits`,
        action: 'Consider transferring credits to balance utilization'
      });
    }

    // IGST Optimization
    if (igst > (cgst + sgst) * 1.2) {
      suggestions.push({
        type: 'Excess IGST',
        severity: 'info',
        message: 'IGST credits are significantly higher than CGST+SGST',
        action: 'Utilize IGST credits first for better optimization'
      });
    }

    // Credit Utilization Rate
    const totalCredits = cgst + sgst + igst;
    const utilizedCredits = credits.claims?.reduce((sum, claim) => 
      sum + (claim.status === 'APPROVED' ? claim.eligible_amount : 0), 0) || 0;
    
    if (utilizedCredits / totalCredits < 0.3) {
      suggestions.push({
        type: 'Low Utilization',
        severity: 'alert',
        message: 'Credit utilization rate is below 30%',
        action: 'Review and plan credit utilization strategy'
      });
    }

    return suggestions;
  };

  if (isLoading) return <div>Loading...</div>;

  const suggestions = getOptimizationSuggestions();

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Credit Optimization</h1>
        </div>

        {/* Credit Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">CGST Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{credits?.credits?.cgst.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">SGST Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{credits?.credits?.sgst.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">IGST Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{credits?.credits?.igst.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Optimization Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle>Optimization Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {suggestions.map((suggestion, index) => (
                <div key={index} className={`p-4 rounded-lg border-l-4 ${
                  suggestion.severity === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                  suggestion.severity === 'alert' ? 'border-red-500 bg-red-50' :
                  'border-blue-500 bg-blue-50'
                }`}>
                  <h3 className="font-semibold flex items-center gap-2">
                    {suggestion.severity === 'warning' && <AlertCircle className="w-5 h-5 text-yellow-500" />}
                    {suggestion.severity === 'alert' && <AlertCircle className="w-5 h-5 text-red-500" />}
                    {suggestion.severity === 'info' && <TrendingUp className="w-5 h-5 text-blue-500" />}
                    {suggestion.type}
                  </h3>
                  <p className="mt-1 text-sm">{suggestion.message}</p>
                  <p className="mt-2 text-sm font-medium">{suggestion.action}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Historical Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Credit Utilization Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={credits?.history}>
                  <XAxis dataKey="created_at" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="cgst" stroke="#0ea5e9" name="CGST" />
                  <Line type="monotone" dataKey="sgst" stroke="#22c55e" name="SGST" />
                  <Line type="monotone" dataKey="igst" stroke="#f59e0b" name="IGST" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}