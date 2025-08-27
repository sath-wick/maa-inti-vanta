import React, { useState, useEffect } from "react";
import { ref, onValue, update } from "firebase/database";
import { database } from "./firebase";
import { format } from "date-fns";

export default function Deliveries() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all"); // all, paid, overpaid, pending
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [mealTypeFilter, setMealTypeFilter] = useState(""); // breakfast, lunch, dinner, bakery or ""
  const [orders, setOrders] = useState({}); // fetched from firebase

  useEffect(() => {
    if (!date) return;
    const ordersRef = ref(database, `customerOrderHistory`);
    onValue(ordersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const filteredOrders = {};

      // Iterate each customer
      Object.entries(data).forEach(([customerId, custData]) => {
        if (!custData.orders) return;
        // Filter orders for selected date
        const todaysOrders = custData.orders.filter(
          (order) => order.date === date &&
            (mealTypeFilter === "" || order.mealType === mealTypeFilter)
        );
        if (todaysOrders.length === 0) return;

        // Filter by customer search text
        const custNameMatch =
          custData.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (!searchTerm);

        if (!custNameMatch) return;

        todaysOrders.forEach(order => {
          // categorize based on due and payment:
          // order.grandTotal (From billing) and order.paymentReceived should be compared
          // We'll assume paymentReceived field exists and defaults to 0 if not.

          let paidAmt = order.paymentReceived || 0;
          let due = order.grandTotal - paidAmt;

          let status = "pending"; // default
          if (due === 0) status = "paid";
          else if (due < 0) status = "overpaid";

          if (
            filter === "all" ||
            (filter === "paid" && status === "paid") ||
            (filter === "overpaid" && status === "overpaid") ||
            (filter === "pending" && status === "pending")
          ) {
            if (!filteredOrders[order.mealType]) filteredOrders[order.mealType] = [];
            filteredOrders[order.mealType].push({
              customerId,
              customerName: custData.name,
              orderId: order.id, // assuming order has id
              due,
              paidAmt,
              paymentMode: order.paymentMode || "offline",
              delivered: order.delivered || false,
            });
          }
        });
      });

      setOrders(filteredOrders);
    });
  }, [date, filter, searchTerm, mealTypeFilter]);

  const [paymentAmounts, setPaymentAmounts] = useState({});
  const [paymentModes, setPaymentModes] = useState({});
  const [deliveredStatus, setDeliveredStatus] = useState({});

  const handlePaymentChange = (orderKey, val) => {
    setPaymentAmounts({ ...paymentAmounts, [orderKey]: val });
  };

  const handlePaymentModeChange = (orderKey, val) => {
    setPaymentModes({ ...paymentModes, [orderKey]: val });
  };

  const handleDeliveredChange = (orderKey, val) => {
    setDeliveredStatus({ ...deliveredStatus, [orderKey]: val });
  };

  const makePayment = (mealType, index) => {
    const order = orders[mealType][index];
    if (!order) return;

    const orderKey = `${order.customerId}_${mealType}_${index}`;

    const enteredPayment = Number(paymentAmounts[orderKey]) || 0;
    let newDue = order.due - enteredPayment;

    const paymentMode = paymentModes[orderKey] || order.paymentMode || "offline";
    const delivered = deliveredStatus[orderKey] ?? order.delivered;

    // Update Firebase: path example customerOrderHistory/{customerId}/orders/{orderId}
    const updatePath = ref(database, `customerOrderHistory/${order.customerId}/orders/${order.orderId}`);
    update(updatePath, {
      paymentReceived: (order.paidAmt || 0) + enteredPayment,
      paymentMode,
      delivered
    }).then(() => {
      alert("Payment and delivery status updated.");
      // Reset form states for this order
      setPaymentAmounts((prev) => {
        const copy = { ...prev };
        delete copy[orderKey];
        return copy;
      });
      setPaymentModes((prev) => {
        const copy = { ...prev };
        delete copy[orderKey];
        return copy;
      });
      setDeliveredStatus((prev) => {
        const copy = { ...prev };
        delete copy[orderKey];
        return copy;
      });
    });
  };

  return (
    <div className="p-4 max-w-screen-md mx-auto space-y-4">
      <div>
        <label>
          Search Customer:{" "}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border p-1"
          />
        </label>
      </div>
      <div>
        <label>
          Date:{" "}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      <div>
        <label>
          Filter:{" "}
          <select onChange={(e) => setFilter(e.target.value)} value={filter}>
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="overpaid">Overpaid</option>
            <option value="pending">Pending</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          Meal Type:{" "}
          <select
            onChange={(e) => setMealTypeFilter(e.target.value)}
            value={mealTypeFilter}
          >
            <option value="">All</option>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="bakery">Bakery</option>
          </select>
        </label>
      </div>

      {Object.entries(orders).map(([mealType, ordersArr]) => (
        <div key={mealType} className="border p-2 rounded mb-4">
          <h3 className="font-bold mb-2 capitalize">{mealType}</h3>
          {ordersArr.length === 0 && <p>No orders for this meal type.</p>}
          {ordersArr.map((order, index) => {
            const orderKey = `${order.customerId}_${mealType}_${index}`;

            let statusColor = "text-black";
            if (order.due > 0) statusColor = "text-red-600";
            else if (order.due < 0) statusColor = "text-green-600";
            else statusColor = "text-blue-600";

            return (
              <div
                key={orderKey}
                className={`flex gap-3 items-center py-1 ${statusColor}`}
              >
                <div>
                  <input
                    type="radio"
                    checked={deliveredStatus[orderKey] ?? order.delivered}
                    onChange={(e) =>
                      handleDeliveredChange(orderKey, e.target.checked)
                    }
                  />{" "}
                  Delivered
                </div>
                <div className="w-48">{order.customerName}</div>
                <div className="w-20">₹{order.due.toFixed(2)}</div>

                <div>
                  <label>
                    <input
                      type="radio"
                      name={`paymentMode_${orderKey}`}
                      value="online"
                      checked={
                        (paymentModes[orderKey] ?? order.paymentMode) ===
                        "online"
                      }
                      onChange={(e) =>
                        handlePaymentModeChange(orderKey, e.target.value)
                      }
                    />{" "}
                    Online
                  </label>
                  <label className="ml-2">
                    <input
                      type="radio"
                      name={`paymentMode_${orderKey}`}
                      value="offline"
                      checked={
                        (paymentModes[orderKey] ?? order.paymentMode) ===
                        "offline"
                      }
                      onChange={(e) =>
                        handlePaymentModeChange(orderKey, e.target.value)
                      }
                    />{" "}
                    Offline
                  </label>
                </div>

                <input
                  type="number"
                  min="0"
                  placeholder="Amount"
                  className="border p-1 w-24"
                  value={paymentAmounts[orderKey] ?? ""}
                  onChange={(e) => handlePaymentChange(orderKey, e.target.value)}
                />

                <button
                  className="bg-green-600 text-white px-3 py-1 rounded"
                  onClick={() => makePayment(mealType, index)}
                  disabled={!paymentAmounts[orderKey]}
                >
                  Make Payment
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
