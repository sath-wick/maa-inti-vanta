import React, { useEffect, useState } from "react";
import { ref, onValue, update } from "firebase/database";
import { database } from "./firebase";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { format, parse } from "date-fns";

const mealLabels = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

const toDDMMYYYY = (dateStr) => {
  if (!dateStr) return "";
  const d = parse(dateStr, "yyyy-MM-dd", new Date());
  return format(d, "dd-MM-yyyy");
};

const toYYYYMMDD = (dateStr) => {
  if (!dateStr) return "";
  const d = parse(dateStr, "dd-MM-yyyy", new Date());
  return format(d, "yyyy-MM-dd");
};

export default function OrderHistorySummary() {
  const [orders, setOrders] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editingOrders, setEditingOrders] = useState([]);

  useEffect(() => {
    const ordersRef = ref(database, "customerOrderHistory");

    const unsubscribe = onValue(ordersRef, (snap) => {
      const data = snap.val() || {};
      const list = [];

      Object.entries(data).forEach(([customerId, customerNode]) => {
        const ordersObj = customerNode.orders || {};
        Object.entries(ordersObj).forEach(([orderId, order]) => {
          list.push({
            ...order,
            customerId,
            orderId,
            customerName: order.customerName || "Unknown",
            items: order.items || [],
          });
        });
      });

      setOrders(list);
    });

    return () => unsubscribe();
  }, []);

  const filteredOrders = selectedDate
    ? orders.filter((o) => o.date === toYYYYMMDD(selectedDate))
    : orders;

  const customerMap = {};
  filteredOrders.forEach((order) => {
    const id = order.customerId;
    if (!customerMap[id]) {
      customerMap[id] = {
        name: order.customerName,
        orders: [],
      };
    }
    customerMap[id].orders.push(order);
  });

  const handleEdit = (customerId) => {
    const allOrders = orders.filter((o) => o.customerId === customerId);
    const editable = selectedDate
      ? allOrders.filter((o) => o.date === toYYYYMMDD(selectedDate))
      : allOrders;

    setEditingCustomer({ id: customerId, name: allOrders[0]?.customerName || "Unknown" });
    setEditingOrders([...editable.map((o) => ({ ...o, items: o.items || [] }))]);
    setEditDialogOpen(true);
  };

  const handleItemChange = (orderId, index, field, value) => {
    const newOrders = editingOrders.map((o) => {
      if (o.orderId !== orderId) return o;
      const items = [...(o.items || [])];
      items[index] = {
        ...items[index],
        [field]: field === "price" || field === "quantity" ? Number(value) : value,
      };
      return { ...o, items };
    });
    setEditingOrders(newOrders);
  };

  const handleAddItem = (orderId) => {
    const newOrders = editingOrders.map((o) => {
      if (o.orderId !== orderId) return o;
      return {
        ...o,
        items: [...(o.items || []), { name: "", price: 0, quantity: 1 }],
      };
    });
    setEditingOrders(newOrders);
  };

  const handleRemoveItem = (orderId, index) => {
    const newOrders = editingOrders.map((o) => {
      if (o.orderId !== orderId) return o;
      const items = [...(o.items || [])];
      items.splice(index, 1);
      return { ...o, items };
    });
    setEditingOrders(newOrders);
  };

  const handleDeliveryChange = (orderId, value) => {
    const newOrders = editingOrders.map((o) => {
      if (o.orderId !== orderId) return o;
      return { ...o, deliveryCharges: Number(value) };
    });
    setEditingOrders(newOrders);
  };

  const handleSaveUpdates = async () => {
    const updates = {};
    editingOrders.forEach((order) => {
      const grandTotal =
        (order.items || []).reduce(
          (sum, i) => sum + i.price * i.quantity,
          0
        ) + Number(order.deliveryCharges || 0);
      updates[`customerOrderHistory/${order.customerId}/orders/${order.orderId}`] = {
        ...order,
        grandTotal,
      };
    });

    await update(ref(database), updates);
    setEditDialogOpen(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto text-white space-y-6 bg-[#181c23] rounded-lg">
      <div className="flex flex-col md:flex-row gap-3 items-center">
        <Label>Select Date:</Label>
        <Input
          type="date"
          value={selectedDate ? toYYYYMMDD(selectedDate) : ""}
          onChange={(e) => setSelectedDate(toDDMMYYYY(e.target.value))}
          className="bg-[#23272f] text-white"
        />
        <Button variant="outline" onClick={() => setSelectedDate("")}>
          Clear Date
        </Button>
      </div>

      <div>
        <Label>Search Customer</Label>
        <Input
          placeholder="Customer name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-1 bg-[#23272f] text-white"
        />
      </div>

      {Object.entries(customerMap)
        .filter(([_, c]) => c.name.toLowerCase().includes(search.toLowerCase()))
        .map(([customerId, cust]) => (
          <div key={customerId} className="bg-[#23272f] p-4 mt-4 rounded">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold">{cust.name}</h2>
              <Button onClick={() => handleEdit(customerId)}>✏️ Edit</Button>
            </div>
            {(cust.orders || []).map((order) => (
              <div
                key={order.orderId}
                className="mb-2 text-sm border-b border-gray-600 pb-2"
              >
                <div className="mb-1">
                  <strong>{mealLabels[order.mealType]}</strong> |{" "}
                  {toDDMMYYYY(order.date)}
                </div>
                <ul className="list-disc ml-4">
                  {(order.items || []).map((i, idx) => (
                    <li key={idx}>
                      {i.name} - ₹{i.price} x {i.quantity} = ₹
                      {i.price * i.quantity}
                    </li>
                  ))}
                </ul>
                <div className="text-sm mt-1">
                  Delivery: ₹{order.deliveryCharges}
                </div>
                <div className="text-sm font-bold">
                  Total: ₹{order.grandTotal}
                </div>
              </div>
            ))}
          </div>
        ))}

      {/* ✏️ Edit Modal */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-[#23272f] text-white max-h-screen overflow-y-scroll">
          <h2 className="text-lg font-bold mb-3">
            Edit Orders - {editingCustomer?.name}
          </h2>

          {(editingOrders || []).map((order) => (
            <div key={order.orderId} className="mb-4 border-b border-gray-600">
              <h3 className="font-semibold mb-2">
                {mealLabels[order.mealType]} | {toDDMMYYYY(order.date)}
              </h3>
              <table className="w-full table-auto text-sm mb-2">
                <thead>
                  <tr>
                    <th className="text-left">Item</th>
                    <th>Qty</th>
                    <th>₹</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((item, index) => (
                    <tr key={index}>
                      <td>
                        <Input
                          value={item.name}
                          onChange={(e) =>
                            handleItemChange(order.orderId, index, "name", e.target.value)
                          }
                          className="bg-[#1f2937] text-white"
                        />
                      </td>
                      <td>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(order.orderId, index, "quantity", e.target.value)
                          }
                          className="bg-[#1f2937] text-white"
                        />
                      </td>
                      <td>
                        <Input
                          type="number"
                          value={item.price}
                          onChange={(e) =>
                            handleItemChange(order.orderId, index, "price", e.target.value)
                          }
                          className="bg-[#1f2937] text-white"
                        />
                      </td>
                      <td>
                        <button
                          className="text-red-500"
                          onClick={() => handleRemoveItem(order.orderId, index)}
                        >
                          ❌
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button onClick={() => handleAddItem(order.orderId)} size="sm">
                ➕ Add Item
              </Button>
              <div className="mt-3">
                <Label>Delivery Charges</Label>
                <Input
                  type="number"
                  value={order.deliveryCharges}
                  onChange={(e) =>
                    handleDeliveryChange(order.orderId, e.target.value)
                  }
                  className="bg-[#1f2937] text-white mt-1"
                />
              </div>
            </div>
          ))}
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUpdates}>💾 Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
