const Finance = require('../models/Finance');

exports.getFinanceReport = async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const [stats, paymentBreakdown, fieldRevenue, recentTransactions] = await Promise.all([
      Finance.getStats(tenantId),
      Finance.getPaymentBreakdown(tenantId),
      Finance.getFieldRevenue(tenantId),
      Finance.getRecentTransactions(tenantId)
    ]);

    res.json({
      stats,
      paymentBreakdown,
      fieldRevenue,
      recentTransactions
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating finance report', error: error.message });
  }
};
