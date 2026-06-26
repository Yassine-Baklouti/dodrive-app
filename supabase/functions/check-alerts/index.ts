import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create Supabase client
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const alertsCreated: string[] = [];

    // Check for expiring vehicle documents (insurance, inspection)
    const { data: vehicleDocs } = await supabase
      .from("vehicle_documents")
      .select("*, vehicles(vehicle_number, brand, model, registration)")
      .in("document_type", ["assurance", "controle_technique"])
      .gte("expiry_date", today.toISOString().split("T")[0])
      .lte("expiry_date", thirtyDaysFromNow.toISOString().split("T")[0]);

    for (const doc of vehicleDocs || []) {
      const expiryDate = new Date(doc.expiry_date);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Check if alert already exists
      const { data: existingAlert } = await supabase
        .from("alerts")
        .select("id")
        .eq("reference_type", "vehicle")
        .eq("reference_id", doc.vehicle_id)
        .eq("alert_type", doc.document_type === "assurance" ? "insurance_expiry" : "inspection_expiry")
        .eq("is_resolved", false)
        .single();

      if (!existingAlert) {
        const vehicle = doc.vehicles as { vehicle_number: string; brand: string; model: string; registration: string };
        const vehicleInfo = `${vehicle.brand} ${vehicle.model} (${vehicle.registration})`;

        await supabase.from("alerts").insert({
          alert_type: doc.document_type === "assurance" ? "insurance_expiry" : "inspection_expiry",
          reference_type: "vehicle",
          reference_id: doc.vehicle_id,
          title: doc.document_type === "assurance"
            ? `Assurance expire dans ${daysUntilExpiry} jours`
            : `Contrôle technique expire dans ${daysUntilExpiry} jours`,
          message: `${vehicleInfo} - Document: ${doc.name}`,
          priority: daysUntilExpiry <= 7 ? "high" : daysUntilExpiry <= 14 ? "medium" : "low",
          due_date: doc.expiry_date,
        });

        alertsCreated.push(`${vehicleInfo} - ${doc.document_type}`);
      }
    }

    // Check for expired vehicle documents
    const { data: expiredDocs } = await supabase
      .from("vehicle_documents")
      .select("*, vehicles(vehicle_number, brand, model, registration)")
      .in("document_type", ["assurance", "controle_technique"])
      .lt("expiry_date", today.toISOString().split("T")[0]);

    for (const doc of expiredDocs || []) {
      // Check if alert already exists
      const { data: existingAlert } = await supabase
        .from("alerts")
        .select("id")
        .eq("reference_type", "vehicle")
        .eq("reference_id", doc.vehicle_id)
        .eq("alert_type", doc.document_type === "assurance" ? "insurance_expiry" : "inspection_expiry")
        .eq("is_resolved", false)
        .single();

      if (!existingAlert) {
        const vehicle = doc.vehicles as { vehicle_number: string; brand: string; model: string; registration: string };
        const vehicleInfo = `${vehicle.brand} ${vehicle.model} (${vehicle.registration})`;

        await supabase.from("alerts").insert({
          alert_type: doc.document_type === "assurance" ? "insurance_expiry" : "inspection_expiry",
          reference_type: "vehicle",
          reference_id: doc.vehicle_id,
          title: doc.document_type === "assurance"
            ? "Assurance EXPIREE"
            : "Contrôle technique EXPIRE",
          message: `${vehicleInfo} - Document: ${doc.name}`,
          priority: "high",
          due_date: doc.expiry_date,
        });

        alertsCreated.push(`${vehicleInfo} - ${doc.document_type} (EXPIRED)`);
      }
    }

    // Check for overdue invoices
    const { data: overdueInvoices } = await supabase
      .from("invoices")
      .select("*, clients(first_name, last_name)")
      .eq("status", "pending")
      .lt("due_date", today.toISOString().split("T")[0]);

    for (const invoice of overdueInvoices || []) {
      const { data: existingAlert } = await supabase
        .from("alerts")
        .select("id")
        .eq("reference_type", "invoice")
        .eq("reference_id", invoice.id)
        .eq("alert_type", "invoice_overdue")
        .eq("is_resolved", false)
        .single();

      if (!existingAlert) {
        const client = invoice.clients as { first_name: string; last_name: string };
        const daysOverdue = Math.ceil((today.getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24));

        await supabase.from("alerts").insert({
          alert_type: "invoice_overdue",
          reference_type: "invoice",
          reference_id: invoice.id,
          title: `Facture en retard (${daysOverdue} jours)`,
          message: `${invoice.invoice_number} - ${client.first_name} ${client.last_name} - ${invoice.total_amount} €`,
          priority: daysOverdue >= 30 ? "high" : daysOverdue >= 14 ? "medium" : "low",
          due_date: invoice.due_date,
        });

        // Also update invoice status to overdue
        await supabase
          .from("invoices")
          .update({ status: "overdue" })
          .eq("id", invoice.id);

        alertsCreated.push(`${invoice.invoice_number} - OVERDUE`);
      }
    }

    // Check for contracts ending soon
    const { data: endingContracts } = await supabase
      .from("contracts")
      .select("*, clients(first_name, last_name), vehicles(brand, model, registration)")
      .eq("status", "active")
      .gte("end_date", today.toISOString().split("T")[0])
      .lte("end_date", new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

    for (const contract of endingContracts || []) {
      const { data: existingAlert } = await supabase
        .from("alerts")
        .select("id")
        .eq("reference_type", "contract")
        .eq("reference_id", contract.id)
        .eq("alert_type", "contract_ending")
        .eq("is_resolved", false)
        .single();

      if (!existingAlert) {
        const client = contract.clients as { first_name: string; last_name: string };
        const vehicle = contract.vehicles as { brand: string; model: string; registration: string };
        const daysUntilEnd = Math.ceil((new Date(contract.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        await supabase.from("alerts").insert({
          alert_type: "contract_ending",
          reference_type: "contract",
          reference_id: contract.id,
          title: `Contrat se termine dans ${daysUntilEnd} jours`,
          message: `${contract.contract_number} - ${client.first_name} ${client.last_name} - ${vehicle.brand} ${vehicle.model}`,
          priority: daysUntilEnd <= 1 ? "high" : "medium",
          due_date: contract.end_date,
        });

        alertsCreated.push(`${contract.contract_number} - ENDING`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        alerts_created: alertsCreated.length,
        alerts: alertsCreated,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});
