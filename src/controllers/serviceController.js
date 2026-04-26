const knex = require('knex')(require('../../knexfile')[process.env.NODE_ENV || 'development']);

exports.getAllServices = async (req, res) => {
    try {
        const services = await knex('services').where('tenant_id', req.params.tenantId);
        res.json(services);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createService = async (req, res) => {
    try {
        const [id] = await knex('services').insert(req.body);
        const newService = await knex('services').where('id', id).first();
        res.status(201).json(newService);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateService = async (req, res) => {
    try {
        await knex('services').where('id', req.params.id).update(req.body);
        const updated = await knex('services').where('id', req.params.id).first();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deleteService = async (req, res) => {
    try {
        await knex('services').where('id', req.params.id).del();
        res.json({ message: 'Service deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getBookingServices = async (req, res) => {
    try {
        const services = await knex('booking_services')
            .join('services', 'booking_services.service_id', 'services.id')
            .where('booking_services.booking_id', req.params.bookingId)
            .select('booking_services.*', 'services.name', 'services.unit');
        res.json(services);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.addBookingService = async (req, res) => {
    try {
        const { booking_id, service_id, quantity, price_at_time } = req.body;
        const [id] = await knex('booking_services').insert({
            booking_id,
            service_id,
            quantity,
            price_at_time
        });
        const newItem = await knex('booking_services').where('id', id).first();
        res.status(201).json(newItem);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
