const { GoogleGenerativeAI } = require("@google/generative-ai");
const Field = require("../models/Field");
const Booking = require("../models/Booking");
const Customer = require("../models/Customer");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const aiTools = {
  get_field_list: async ({ tenant_id }) => {
    try {
      const fields = await Field.findByTenant(tenant_id);
      return fields.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        price_per_hour: f.price_per_hour,
        amenities: f.amenities,
        description: f.description,
        status: f.status
      }));
    } catch (error) {
      return { error: "Could not fetch fields" };
    }
  },

  check_availability: async ({ tenant_id, field_id, date, start_time, duration }) => {
    try {
      const bookings = await Booking.findByTenant(tenant_id, {
        field: field_id,
        date: date
      });

      const sTime = start_time.substring(0, 5);
      const [h, m] = sTime.split(':').map(Number);
      const totalMins = h * 60 + m + Math.round(duration * 60);
      const endH = Math.floor(totalMins / 60);
      const endM = totalMins % 60;
      const eTime = (endH < 10 ? '0' + endH : endH) + ':' + (endM < 10 ? '0' + endM : endM);

      const hasConflict = bookings.some(booking => {
        if (!['confirmed', 'pending', 'completed'].includes(booking.status)) return false;
        
        const bStart = booking.start_time.substring(0, 5);
        const bEnd   = booking.end_time.substring(0, 5);
        
        return (sTime >= bStart && sTime < bEnd) || 
               (eTime > bStart && eTime <= bEnd) ||
               (sTime <= bStart && eTime >= bEnd);
      });

      return { available: !hasConflict, start_time: sTime, end_time: eTime };
    } catch (error) {
      return { error: "Could not check availability" };
    }
  },

  create_booking: async ({ tenant_id, field_id, customer_name, customer_phone, date, start_time, duration, note }) => {
    try {
      // Re-verify availability
      const availability = await aiTools.check_availability({ tenant_id, field_id, date, start_time, duration });
      if (!availability.available) {
        return { error: "Time slot is no longer available" };
      }

      const fields = await Field.findByTenant(tenant_id);
      const field = fields.find(f => f.id === field_id);
      if (!field) return { error: "Field not found" };

      const totalPrice = field.price_per_hour * duration;
      const bookingId = `bk_ai_${Date.now()}`;
      
      const bookingData = {
        id: bookingId,
        tenant_id,
        field_id,
        customer_name,
        customer_phone,
        date,
        start_time: availability.start_time,
        end_time: availability.end_time,
        duration,
        total_price: totalPrice,
        status: 'pending',
        payment_method: 'cash',
        paid: false,
        qr_code: `QR-AI-${bookingId.toUpperCase().slice(-6)}`,
        note: `[AI Chatbot] ${note || ""}`
      };

      const newBooking = await Booking.create(bookingData);

      // Sync Customer
      let customer = await Customer.findByPhone(tenant_id, customer_phone);
      if (!customer) {
        await Customer.create({
          id: `c_${Date.now()}`,
          tenant_id,
          name: customer_name,
          phone: customer_phone,
          total_bookings: 1,
          total_spent: totalPrice,
          last_visit: date,
          status: 'new',
          joined: new Date().toISOString().slice(0, 10)
        });
      } else {
        await Customer.updateStats(customer.id, totalPrice, date);
      }

      return { success: true, booking: newBooking };
    } catch (error) {
      return { error: "Failed to create booking: " + error.message };
    }
  },

  search_my_bookings: async ({ tenant_id, customer_phone }) => {
    try {
      const bookings = await Booking.findByTenant(tenant_id, { q: customer_phone });
      return bookings.map(b => ({
        id: b.id,
        field_name: b.field_name,
        date: b.date,
        time: `${b.start_time.substring(0, 5)} - ${b.end_time.substring(0, 5)}`,
        status: b.status,
        total_price: b.total_price,
        qr_code: b.qr_code
      }));
    } catch (error) {
      return { error: "Could not search bookings" };
    }
  }
};

const functions = [
  {
    name: "get_field_list",
    description: "Get a list of all football fields available for a specific tenant/business.",
    parameters: {
      type: "object",
      properties: {
        tenant_id: { type: "string", description: "The ID of the tenant/business." }
      },
      required: ["tenant_id"]
    }
  },
  {
    name: "check_availability",
    description: "Check if a football field is available at a specific date and time.",
    parameters: {
      type: "object",
      properties: {
        tenant_id: { type: "string" },
        field_id: { type: "string" },
        date: { type: "string", description: "Date in YYYY-MM-DD format." },
        start_time: { type: "string", description: "Start time in HH:mm format." },
        duration: { type: "number", description: "Duration in hours (e.g. 1.5)." }
      },
      required: ["tenant_id", "field_id", "date", "start_time", "duration"]
    }
  },
  {
    name: "create_booking",
    description: "Create a new booking for a football field.",
    parameters: {
      type: "object",
      properties: {
        tenant_id: { type: "string" },
        field_id: { type: "string" },
        customer_name: { type: "string" },
        customer_phone: { type: "string" },
        date: { type: "string", description: "Date in YYYY-MM-DD format." },
        start_time: { type: "string", description: "Start time in HH:mm format." },
        duration: { type: "number", description: "Duration in hours." },
        note: { type: "string" }
      },
      required: ["tenant_id", "field_id", "customer_name", "customer_phone", "date", "start_time", "duration"]
    }
  },
  {
    name: "search_my_bookings",
    description: "Find existing bookings for a customer using their phone number.",
    parameters: {
      type: "object",
      properties: {
        tenant_id: { type: "string" },
        customer_phone: { type: "string" }
      },
      required: ["tenant_id", "customer_phone"]
    }
  }
];

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  tools: [{ functionDeclarations: functions }],
});

exports.chat = async (tenantId, history, message) => {
  const chat = model.startChat({
    history: history,
    generationConfig: {
      maxOutputTokens: 1000,
    },
  });

  // Inject system context into the first message if history is empty
  let prompt = message;
  if (history.length === 0) {
    prompt = `You are a helpful assistant for a Football Field booking system (Tenant ID: ${tenantId}). 
    You can help users find fields, check availability, book a field, or look up their existing bookings.
    Today is ${new Date().toISOString().split('T')[0]}.
    Please speak Vietnamese. 
    
    User message: ${message}`;
  }

  let result = await chat.sendMessage(prompt);
  let response = result.response;

  // Handle function calls
  let createdBooking = null;
  const calls = response.functionCalls();
  if (calls) {
    const toolResults = {};
    for (const call of calls) {
      const toolName = call.name;
      const args = call.args;
      console.log(`AI calling tool: ${toolName}`, args);
      
      if (aiTools[toolName]) {
        toolResults[toolName] = await aiTools[toolName](args);
        
        // Capture booking if one was created
        if (toolName === 'create_booking' && toolResults[toolName].success) {
          createdBooking = toolResults[toolName].booking;
        }
      }
    }

    // Send tool outcomes back to AI
    const toolResponses = Object.keys(toolResults).map(name => ({
      functionResponse: {
        name: name,
        response: { content: toolResults[name] }
      }
    }));

    result = await chat.sendMessage(toolResponses);
    response = result.response;
  }

  return {
    text: response.text(),
    booking: createdBooking,
    history: await chat.getHistory()
  };
};
