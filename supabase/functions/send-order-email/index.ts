import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
// Secure email notification edge function with JWT verification and HTML escaping

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SHOP_NAME = "Madina Cotton Shop";
const SHOP_PHONE = "0313 3344068";
const SHOP_ADDRESS = "Latifabad Unit 11, Near Tameer Bank, Hyderabad, Sindh, Pakistan";
const OWNER_EMAIL = "myousufshaikh399@gmail.com";
const RESEND_FROM = "Madina Cotton Shop <onboarding@resend.dev>";

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function emailHeader(title: string, subtitle: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#d96f2e;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:24px;">${SHOP_NAME}</h1>
        <p style="margin:5px 0 0;opacity:0.9;">${escapeHtml(subtitle)}</p>
      </div>
      <div style="padding:20px;border:1px solid #ddd;border-radius:0 0 8px 8px;">
        <h2 style="color:#333;">${escapeHtml(title)}</h2>`;
}

function emailFooter(): string {
  return `
        <div style="margin-top:20px;padding-top:15px;border-top:1px solid #ddd;font-size:13px;color:#999;">
          <p>${SHOP_NAME}</p>
          <p>${SHOP_ADDRESS}</p>
          <p>Phone: ${SHOP_PHONE}</p>
        </div>
      </div>
    </div>`;
}

async function sendEmail(subject: string, html: string, toEmail?: string): Promise<{ success: boolean; message: string; emailId?: string }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    console.log("RESEND_API_KEY not configured. Email not sent.");
    return {
      success: false,
      message: "Email service not configured.",
    };
  }

  try {
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [toEmail || OWNER_EMAIL],
        subject,
        html,
      }),
    });

    if (!emailResponse.ok) {
      console.error("Resend API error:", await emailResponse.text());
      return { success: false, message: "Failed to send email." };
    }

    const emailResult = await emailResponse.json();
    return { success: true, message: "Email sent", emailId: emailResult.id };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, message: "Email service unavailable." };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Verify JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userToken = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create client with user's token to verify auth
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client for reading order data
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { type, orderId, customOrderId } = body;

    if (type === "support") {
      const { subject, category, body: messageBody } = body;
      const html = `
        ${emailHeader("New Support Ticket", "Support Notification")}
          <p style="color:#666;font-size:14px;">A customer has created a support ticket.</p>
          <table style="width:100%;margin:15px 0;font-size:14px;">
            <tr><td style="padding:4px 0;color:#666;"><strong>Subject:</strong></td><td>${escapeHtml(subject)}</td></tr>
            <tr><td style="padding:4px 0;color:#666;"><strong>Category:</strong></td><td>${escapeHtml(category)}</td></tr>
          </table>
          <div style="margin-top:10px;padding:10px;background:#f5f5f5;border-radius:4px;font-size:14px;"><strong>Message:</strong><br>${escapeHtml(messageBody)}</div>
          <p style="margin-top:15px;font-size:13px;color:#666;">Please respond to this ticket in the admin dashboard.</p>
        ${emailFooter()}
      `;
      const result = await sendEmail(`New Support Ticket - ${escapeHtml(subject)}`, html);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "wholesale") {
      const { businessName, contact } = body;
      const html = `
        ${emailHeader("New Wholesale Registration", "Wholesale Account Notification")}
          <p style="color:#666;font-size:14px;">A business has registered for a wholesale account.</p>
          <table style="width:100%;margin:15px 0;font-size:14px;">
            <tr><td style="padding:4px 0;color:#666;"><strong>Business:</strong></td><td>${escapeHtml(businessName)}</td></tr>
            <tr><td style="padding:4px 0;color:#666;"><strong>Contact:</strong></td><td>${escapeHtml(contact)}</td></tr>
          </table>
          <p style="margin-top:15px;font-size:13px;color:#666;">Please review and approve this wholesale account in the admin dashboard.</p>
        ${emailFooter()}
      `;
      const result = await sendEmail(`New Wholesale Registration - ${escapeHtml(businessName)}`, html);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "custom_order" || customOrderId) {
      // Verify the caller owns this custom order
      const { data: customOrder, error } = await serviceClient
        .from("custom_orders")
        .select("*, profiles(full_name, phone, email)")
        .eq("id", customOrderId)
        .single();

      if (error || !customOrder) {
        return new Response(
          JSON.stringify({ error: "Not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Only the order owner or staff can trigger this email
      if (customOrder.user_id !== user.id) {
        const { data: profile } = await serviceClient
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (!profile || !["owner", "admin"].includes(profile.role)) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const profile = customOrder.profiles || {};
      const specs = [
        customOrder.product_type && `Product: ${escapeHtml(customOrder.product_type)}`,
        customOrder.size_label && `Size: ${escapeHtml(customOrder.size_label)}`,
        customOrder.width && customOrder.length && `Dimensions: ${customOrder.width} × ${customOrder.length} ${escapeHtml(customOrder.unit)}`,
        customOrder.weight && `Weight: ${escapeHtml(customOrder.weight)}`,
        customOrder.filling && `Filling: ${escapeHtml(customOrder.filling)}`,
        customOrder.fabric && `Fabric: ${escapeHtml(customOrder.fabric)}`,
        customOrder.color && `Color: ${escapeHtml(customOrder.color)}`,
        customOrder.front_design && `Front Design: ${escapeHtml(customOrder.front_design)}`,
        customOrder.back_design && `Back Design: ${escapeHtml(customOrder.back_design)}`,
        customOrder.stitching && `Stitching: ${escapeHtml(customOrder.stitching)}`,
        customOrder.decoration && `Decoration: ${escapeHtml(customOrder.decoration)}`,
        `Quantity: ${customOrder.quantity}`,
      ].filter(Boolean).join("<br>");

      const html = `
        ${emailHeader("New Custom Order Request", "Custom Order Notification")}
          <p style="color:#666;font-size:14px;">A customer has submitted a custom order request.</p>
          <table style="width:100%;margin:15px 0;font-size:14px;">
            <tr><td style="padding:4px 0;color:#666;"><strong>Customer:</strong></td><td>${escapeHtml(profile.full_name)}</td></tr>
            <tr><td style="padding:4px 0;color:#666;"><strong>Phone:</strong></td><td>${escapeHtml(profile.phone)}</td></tr>
            <tr><td style="padding:4px 0;color:#666;"><strong>Email:</strong></td><td>${escapeHtml(profile.email)}</td></tr>
          </table>
          <h3 style="color:#333;font-size:16px;margin-top:20px;">Specifications</h3>
          <div style="font-size:14px;color:#444;">${specs}</div>
          ${customOrder.instructions ? `<p style="margin-top:15px;padding:10px;background:#fff3cd;border-radius:4px;font-size:13px;"><strong>Special Instructions:</strong> ${escapeHtml(customOrder.instructions)}</p>` : ""}
          <p style="margin-top:15px;font-size:13px;color:#666;">Please review this request and create a quote in the admin dashboard.</p>
        ${emailFooter()}
      `;

      const result = await sendEmail(
        `New Custom Order Request - ${escapeHtml(customOrder.product_type)}`,
        html
      );

      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: order email
    let orderQuery = serviceClient.from("orders").select("*, order_items(*)");
    if (orderId) orderQuery = orderQuery.eq("id", orderId);
    else if (body.orderNumber) orderQuery = orderQuery.eq("order_number", body.orderNumber);
    else {
      return new Response(
        JSON.stringify({ error: "orderId or orderNumber required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: order, error: orderError } = await orderQuery.single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller owns this order or is staff
    if (order.user_id !== user.id) {
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (!profile || !["owner", "admin"].includes(profile.role)) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const itemsHtml = (order.order_items || [])
      .map(
        (item: Record<string, unknown>) =>
          `<tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(item.product_name)}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${item.quantity}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">Rs. ${Number(item.unit_price).toLocaleString()}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">Rs. ${(Number(item.unit_price) * item.quantity).toLocaleString()}</td>
          </tr>`
      )
      .join("");

    const html = `
      ${emailHeader("Order " + escapeHtml(order.order_number), "New Order Notification")}
        <p style="color:#666;font-size:14px;">A new order has been placed by a customer.</p>
        <table style="width:100%;margin:15px 0;font-size:14px;">
          <tr><td style="padding:4px 0;color:#666;"><strong>Customer:</strong></td><td>${escapeHtml(order.customer_name)}</td></tr>
          <tr><td style="padding:4px 0;color:#666;"><strong>Phone:</strong></td><td>${escapeHtml(order.customer_phone)}</td></tr>
          <tr><td style="padding:4px 0;color:#666;"><strong>Email:</strong></td><td>${escapeHtml(order.customer_email)}</td></tr>
          <tr><td style="padding:4px 0;color:#666;"><strong>City:</strong></td><td>${escapeHtml(order.city)}</td></tr>
          <tr><td style="padding:4px 0;color:#666;"><strong>Address:</strong></td><td>${escapeHtml(order.address)}</td></tr>
          <tr><td style="padding:4px 0;color:#666;"><strong>Payment:</strong></td><td>${escapeHtml(order.payment_method)}</td></tr>
          <tr><td style="padding:4px 0;color:#666;"><strong>Status:</strong></td><td>${escapeHtml(order.status)}</td></tr>
        </table>
        <h3 style="color:#333;font-size:16px;margin-top:20px;">Order Items</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr style="background:#f5f5f5;">
            <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">Product</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">Qty</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">Unit Price</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">Total</th>
          </tr>
          ${itemsHtml}
        </table>
        <div style="margin-top:15px;font-size:14px;">
          <p style="margin:4px 0;"><strong>Subtotal:</strong> Rs. ${Number(order.subtotal).toLocaleString()}</p>
          <p style="margin:4px 0;"><strong>Shipping:</strong> Rs. ${Number(order.shipping_fee).toLocaleString()}</p>
          <p style="margin:4px 0;font-size:18px;color:#d96f2e;"><strong>Total: Rs. ${Number(order.total).toLocaleString()}</strong></p>
        </div>
        ${order.notes ? `<p style="margin-top:15px;padding:10px;background:#fff3cd;border-radius:4px;font-size:13px;"><strong>Customer Notes:</strong> ${escapeHtml(order.notes)}</p>` : ""}
      ${emailFooter()}
    `;

    const result = await sendEmail(
      `New Order ${escapeHtml(order.order_number)} - ${escapeHtml(order.customer_name)}`,
      html
    );

    return new Response(
      JSON.stringify({
        ...result,
        orderNumber: order.order_number,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in send-order-email:", err);
    return new Response(
      JSON.stringify({ error: "An internal error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
