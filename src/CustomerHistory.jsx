import React, { useState, useEffect } from "react";
import { database } from "./firebase";
import { ref, onValue, update, remove } from "firebase/database";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";

function ThreeDotMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        className="px-2 py-1 text-gray-300 hover:text-white"
        onClick={() => setOpen(o => !o)}
      >
        ⋮
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-28 bg-[#23272f] border border-gray-700 rounded shadow-lg z-10">
          <button
            className="block w-full text-left px-4 py-2 text-gray-100 hover:bg-gray-700"
            onClick={() => { setOpen(false); onEdit(); }}
          >
            Edit
          </button>
          <button
            className="block w-full text-left px-4 py-2 text-red-400 hover:bg-gray-700"
            onClick={() => { setOpen(false); onDelete(); }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function EditOrderModal({ order, onSave, onClose }) {
  const [editItems, setEditItems] = useState(order.items.map(item => ({ ...item })));
  const [editDelivery, setEditDelivery] = useState(order.deliveryCharges || 0);

  const handleItemChange = (idx, field, value) => {
    setEditItems(items =>
      items.map((item, i) => i === idx ? { ...item, [field]: value } : item)
    );
  };

  const handleSave = () => {
    if (!window.confirm("Are you sure you want to save changes to this order?")) return;
    const grandTotal = editItems.reduce((sum, item) => sum + item.price * item.quantity, 0) + Number(editDelivery);
    onSave({ ...order, items: editItems, deliveryCharges: editDelivery, grandTotal });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
      <div className="bg-[#23272f] rounded-lg p-6 w-full max-w-md">
        <h3 className="font-bold mb-2 text-gray-100">Edit Order</h3>
        {editItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 mt-2">
            <Input
              value={item.name}
              onChange={e => handleItemChange(idx, "name", e.target.value)}
              className="bg-[#181c23] text-gray-100 w-24"
            />
            <Input
              type="number"
              value={item.quantity}
              min={0}
              onChange={e => handleItemChange(idx, "quantity", Number(e.target.value))}
              className="bg-[#181c23] text-gray-100 w-16"
            />
            <Input
              type="number"
              value={item.price}
              min={0}
              onChange={e => handleItemChange(idx, "price", Number(e.target.value))}
              className="bg-[#181c23] text-gray-100 w-16"
            />
          </div>
        ))}
        <div className="flex items-center mt-2">
          <span className="text-gray-200 mr-2">Delivery:</span>
          <Input
            type="number"
            value={editDelivery}
            min={0}
            onChange={e => setEditDelivery(Number(e.target.value))}
            className="bg-[#181c23] text-gray-100 w-16"
          />
        </div>
        <div className="flex gap-2 mt-4">
          <Button className="bg-green-700 text-gray-100 px-3 py-1" onClick={handleSave}>Save</Button>
          <Button className="bg-gray-700 text-gray-100 px-3 py-1" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

export default function OrderHistoryModule() {
  const [allOrders, setAllOrders] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");
  const [editOrder, setEditOrder] = useState(null);

  // Fetch all customer order history
  useEffect(() => {
    const unsub = onValue(ref(database, "customerOrderHistory"), snap => {
      const data = snap.val() || {};
      const orders = [];
      Object.entries(data).forEach(([customerId, val]) => {
        if (val.orders) {
          Object.entries(val.orders).forEach(([orderId, order]) => {
            orders.push({
              ...order,
              customerId,
              customerName: order.customerName || val.name || "",
              orderId
            });
          });
        }
      });
      setAllOrders(orders);
    });
    return () => unsub();
  }, []);

  // Filtered by date
  const filteredOrders = selectedDate
    ? allOrders.filter(order => order.date === selectedDate)
    : allOrders;

  // SUMMARY: Only show if date is selected
  function getSummary(orders) {
    const summary = {};
    let totalDelivery = 0;
    let grandTotal = 0;
    orders.forEach(order => {
      order.items.forEach(item => {
        if (!summary[item.name]) summary[item.name] = { quantity: 0, price: 0 };
        summary[item.name].quantity += Number(item.quantity);
        summary[item.name].price += Number(item.price) * Number(item.quantity);
      });
      totalDelivery += Number(order.deliveryCharges || 0);
      grandTotal += Number(order.grandTotal || 0);
    });
    return { summary, totalDelivery, grandTotal };
  }
  const { summary, totalDelivery, grandTotal } = getSummary(filteredOrders);
  const { summary: allSummary, totalDelivery: allDelivery, grandTotal: allGrand } = getSummary(allOrders);

  // Group by customer for filtered orders
  const customerMap = {};
  filteredOrders.forEach(order => {
    const id = order.customerId;
    if (!customerMap[id]) customerMap[id] = { name: order.customerName, orders: [] };
    customerMap[id].orders.push(order);
  });

  // Edit and Delete handlers
  const handleEdit = (order) => setEditOrder(order);

  const handleEditSave = async (order) => {
    await update(ref(database, `customerOrderHistory/${order.customerId}/orders/${order.orderId}`), order);
    setEditOrder(null);
  };

  const handleDelete = async (order) => {
    if (!window.confirm("Are you sure you want to delete this order? This cannot be undone.")) return;
    await remove(ref(database, `customerOrderHistory/${order.customerId}/orders/${order.orderId}`));
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-6 bg-[#181c23] rounded-lg">
      {/* Date Selector */}
      <div className="flex flex-col md:flex-row gap-2 items-center mb-2">
        <label className="text-gray-200 font-bold">Select date:</label>
        <Input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="w-full md:w-auto p-2 rounded bg-[#23272f] text-gray-100"
        />
        <Button
          className="ml-2 px-3 py-2 bg-gray-700 text-gray-100 text-xs"
          onClick={() => setSelectedDate("")}
        >
          Clear
        </Button>
      </div>

      {/* SUMMARY Section: Only show if date is selected */}
      {selectedDate && (
        <div className="rounded-lg shadow p-4 mb-4 bg-[#23272f] border border-[#23272f]">
          <div className="flex items-center mb-2">
            <h3 className="text-lg font-bold flex-1 text-gray-100">SUMMARY</h3>
          </div>
          <div>
            {Object.entries(summary).map(([name, { quantity, price }]) => (
              <div key={name} className="flex justify-between py-1 border-b border-[#23272f] text-sm text-gray-100">
                <span>{name}</span>
                <span>{quantity}</span>
                <span>₹{price}</span>
              </div>
            ))}
            <div className="flex justify-between mt-2 font-semibold text-gray-200">
              <span>Total Delivery charges:</span>
              <span>₹{totalDelivery}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-100">
              <span>Grand Total:</span>
              <span>₹{grandTotal}</span>
            </div>
          </div>
        </div>
      )}

      {/* ALL TIME SUMMARY: Only show if no date is selected */}
      {!selectedDate && (
        <div className="rounded-lg shadow p-4 mb-4 bg-[#23272f] border border-[#23272f]">
          <div className="flex items-center mb-2">
            <h3 className="text-lg font-bold flex-1 text-gray-100">ALL TIME SUMMARY</h3>
          </div>
          <div>
            {Object.entries(allSummary).map(([name, { quantity, price }]) => (
              <div key={name} className="flex justify-between py-1 border-b border-[#23272f] text-sm text-gray-100">
                <span>{name}</span>
                <span>{quantity}</span>
                <span>₹{price}</span>
              </div>
            ))}
            <div className="flex justify-between mt-2 font-semibold text-gray-200">
              <span>Total Delivery charges:</span>
              <span>₹{allDelivery}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-100">
              <span>Grand Total:</span>
              <span>₹{allGrand}</span>
            </div>
          </div>
        </div>
      )}

      {/* INDIVIDUAL CUSTOMER HISTORY */}
      <div className="bg-[#23272f] rounded-lg shadow p-4">
        <Label className="text-gray-100 mb-2">INDIVIDUAL CUSTOMER HISTORY</Label>
        <Input
          placeholder="Search customer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full mb-4 p-2 rounded bg-[#181c23] text-gray-100"
        />
        {Object.values(customerMap)
          .filter(cust => cust.name.toLowerCase().includes(search.toLowerCase()))
          .length === 0 && (
            <div className="text-gray-400 text-sm">No customer records found.</div>
          )}
        {Object.values(customerMap)
          .filter(cust => cust.name.toLowerCase().includes(search.toLowerCase()))
          .map(cust => {
            // Calculate grand total for this customer for the selected date
            const customerDayTotal = cust.orders.reduce(
              (sum, order) => sum + Number(order.grandTotal || 0), 0
            );
            return (
              <div key={cust.name} className="mb-6">
                <div className="flex items-center font-bold text-gray-100">
                  {cust.name}
                  <ThreeDotMenu
                    onEdit={() => handleEdit(cust.orders[0])}
                    onDelete={() => handleDelete(cust.orders[0])}
                  />
                </div>
                {cust.orders.map((order, idx) => (
                  <div key={order.orderId} className="ml-4 text-sm text-gray-200">
                    {order.items.map((item, i) =>
                      <div key={i}>
                        {item.name} - {item.quantity} - ₹{item.price * item.quantity}
                      </div>
                    )}
                    <div className="text-gray-400">Delivery: ₹{order.deliveryCharges || 0}</div>
                    <div className="font-semibold text-gray-100">Total: ₹{order.grandTotal || 0}</div>
                  </div>
                ))}
                {/* Grand Total for the day */}
                <div className="ml-4 mt-2 font-bold text-green-300 border-t border-gray-700 pt-2">
                  Grand Total for {selectedDate || "all time"}: ₹{customerDayTotal}
                </div>
              </div>
            );
          })}
      </div>

      {/* Edit Modal */}
      {editOrder && (
        <EditOrderModal
          order={editOrder}
          onSave={async (newOrder) => {
            await update(ref(database, `customerOrderHistory/${editOrder.customerId}/orders/${editOrder.orderId}`), newOrder);
            setEditOrder(null);
          }}
          onClose={() => setEditOrder(null)}
        />
      )}
    </div>
  );
}
