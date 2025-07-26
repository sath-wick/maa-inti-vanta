import React, { useEffect, useState } from "react";
import { ref, onValue, update, remove } from "firebase/database";
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
  bakery: "Bakery",
};

// Defensive parse helper
const safeParse = (value, fmt) => {
  if (!value) return null;
  const d = parse(value, fmt, new Date());
  return isNaN(d.getTime()) ? null : d;
};

// Format date yyyy-MM-dd → dd-MM-yyyy
const toDDMMYYYY = (dateStr) => {
  const d = safeParse(dateStr, "yyyy-MM-dd");
  if (!d) return "";
  return format(d, "dd-MM-yyyy");
};

// Format date dd-MM-yyyy → yyyy-MM-dd
const toYYYYMMDD = (dateStr) => {
  const d = safeParse(dateStr, "dd-MM-yyyy");
  if (!d) return "";
  return format(d, "yyyy-MM-dd");
};

export default function OrderHistorySummary() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [orders, setOrders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayStr);
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
    ? orders.filter((o) => o.date === selectedDate)
    : orders;

  // Summary calculation
  const summaryMeals = { breakfast: {}, lunch: {}, dinner: {}, bakery: {} };
  const mealTotals = { breakfast: 0, lunch: 0, dinner: 0, bakery: 0 };
  const deliveryTotals = { breakfast: 0, lunch: 0, dinner: 0, bakery: 0 };

  filteredOrders.forEach((order) => {
    const { mealType, items = [], deliveryCharges = 0 } = order;
    if (!["breakfast", "lunch", "dinner", "bakery"].includes(mealType)) return;

    items.forEach((item) => {
      if (!summaryMeals[mealType][item.name]) {
        summaryMeals[mealType][item.name] = { quantity: 0, price: item.price || 0 };
      }
      summaryMeals[mealType][item.name].quantity += item.quantity;
    });

    mealTotals[mealType] +=
      items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 0), 0);
    deliveryTotals[mealType] += Number(deliveryCharges) || 0;
  });

  const totalMealsTotal = Object.values(mealTotals).reduce((a, b) => a + b, 0);
  const totalDeliveryTotal = Object.values(deliveryTotals).reduce((a, b) => a + b, 0);
  const grandTotal = totalMealsTotal + totalDeliveryTotal;

  // Group orders by customer
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

  // Delete orders function from main list
  const handleDelete = async (customerId) => {
    const customerOrders = orders.filter((o) => o.customerId === customerId);
    let toDeleteOrderKeys = [];

    if (selectedDate) {
      toDeleteOrderKeys = customerOrders
        .filter((o) => o.date === selectedDate)
        .map((o) => o.orderId);

      if (toDeleteOrderKeys.length === 0) {
        alert("No orders to delete for this date.");
        return;
      }

      if (
        !window.confirm(
          `Are you sure you want to delete ALL orders for "${customerMap[customerId]?.name || "this customer"}" on ${selectedDate}?`
        )
      )
        return;

      const updates = {};
      toDeleteOrderKeys.forEach((orderId) => {
        updates[`customerOrderHistory/${customerId}/orders/${orderId}`] = null;
      });
      await update(ref(database), updates);
    } else {
      if (
        !window.confirm(
          `Are you sure you want to delete the ENTIRE order history of "${customerMap[customerId]?.name || "this customer"}"?`
        )
      )
        return;
      await remove(ref(database, `customerOrderHistory/${customerId}/orders`));
    }
  };

  // Edit modal support functions
  const handleEdit = (customerId) => {
    const allOrders = orders.filter((o) => o.customerId === customerId);
    const editable = selectedDate
      ? allOrders.filter((o) => o.date === selectedDate)
      : allOrders;
    setEditingCustomer({ id: customerId, name: allOrders[0]?.customerName || "Unknown" });
    setEditingOrders([...editable.map((o) => ({ ...o, items: o.items || [] }))]);
    setEditDialogOpen(true);
  };

  const handleItemChange = (orderId, index, field, value) => {
    setEditingOrders((orders) =>
      orders.map((o) => {
        if (o.orderId !== orderId) return o;
        const items = [...(o.items || [])];
        items[index] = {
          ...items[index],
          [field]: field === "price" || field === "quantity" ? Number(value) : value,
        };
        return { ...o, items };
      })
    );
  };

  const handleAddItem = (orderId) => {
    setEditingOrders((orders) =>
      orders.map((o) =>
        o.orderId !== orderId
          ? o
          : { ...o, items: [...(o.items || []), { name: "", price: 0, quantity: 1 }] }
      )
    );
  };

  const handleRemoveItem = (orderId, idx) => {
    setEditingOrders((orders) =>
      orders.map((o) => {
        if (o.orderId !== orderId) return o;
        const items = [...(o.items || [])];
        items.splice(idx, 1);
        return { ...o, items };
      })
    );
  };

  const handleDeliveryChange = (orderId, value) => {
    setEditingOrders((orders) =>
      orders.map((o) =>
        o.orderId !== orderId
          ? o
          : { ...o, deliveryCharges: Number(value) }
      )
    );
  };

  const handleOrderFieldChange = (orderId, field, value) => {
    setEditingOrders((orders) =>
      orders.map((o) =>
        o.orderId === orderId ? { ...o, [field]: value } : o
      )
    );
  };

  // Delete all orders of a meal type within editing state
  const handleDeleteAllMealOrders = (mealTypeToDelete) => {
    setEditingOrders((orders) =>
      orders.filter((order) => order.mealType !== mealTypeToDelete)
    );
  };

  // Save all changes to Firebase
  const handleSaveUpdates = async () => {
    const updates = {};
    editingOrders.forEach((order) => {
      const grandTotal =
        (order.items || []).reduce(
          (sum, i) => sum + (i.price || 0) * (i.quantity || 0),
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
    <div className="p-6 max-w-4xl mx-auto text-white space-y-8 bg-[#181c23] rounded-lg">
      {/* FILTER and SEARCH */}
      <div className="flex flex-col md:flex-row gap-3 items-center">
        <Label>Select Date:</Label>
        <Input
          type="date"
          value={selectedDate && !isNaN(Date.parse(selectedDate)) ? selectedDate : ""}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-[#23272f] text-white"
        />
        <Button variant="outline" onClick={() => setSelectedDate(todayStr)}>
          Today
        </Button>
        <Button variant="outline" onClick={() => setSelectedDate("")}>
          Show All-Time
        </Button>
      </div>

      {/* SUMMARY SECTION */}
      <div>
        <h2 className="text-xl font-bold mb-2">Summary</h2>
        {Object.entries(mealLabels).map(([mealKey, mealLabel]) => (
          <div key={mealKey} className="mb-4">
            <div className="font-semibold text-lg">{mealLabel}:</div>
            {Object.keys(summaryMeals[mealKey]).length === 0 ? (
              <div className="text-gray-400 text-sm mb-2">No orders</div>
            ) : (
              <table className="w-full mb-1 border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="text-left py-1 px-1">Item name</th>
                    <th className="text-right py-1 px-1">Total qty</th>
                    <th className="text-right py-1 px-1">Price × qty</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summaryMeals[mealKey]).map(([itemName, { quantity, price }]) => (
                    <tr key={itemName}>
                      <td className="py-1 px-1">{itemName}</td>
                      <td className="text-right py-1 px-1">{quantity}</td>
                      <td className="text-right py-1 px-1">₹{price * quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex justify-between text-gray-300 text-sm pt-1">
              <span>Meals Total:</span>
              <span>₹{mealTotals[mealKey]}</span>
            </div>
            <div className="flex justify-between text-gray-300 text-sm">
              <span>Meals Delivery Total:</span>
              <span>₹{deliveryTotals[mealKey]}</span>
            </div>
            <div className="flex justify-between font-semibold text-sm border-t border-gray-600 pt-2 mt-1">
              <span>Meal Grand Total:</span>
              <span>₹{mealTotals[mealKey] + deliveryTotals[mealKey]}</span>
            </div>
          </div>
        ))}
        <div className="flex justify-between text-base font-bold border-t border-gray-600 pt-2 mt-2">
          <span>Total Meals Total:</span>
          <span>₹{totalMealsTotal}</span>
        </div>
        <div className="flex justify-between text-base font-bold">
          <span>Total Delivery Total:</span>
          <span>₹{totalDeliveryTotal}</span>
        </div>
        <div className="flex justify-between text-xl font-bold border-t border-gray-600 pt-2">
          <span>Grand Total:</span>
          <span>₹{grandTotal}</span>
        </div>
      </div>

      {/* SEARCH */}
      <div>
        <Label>Search Customer</Label>
        <Input
          placeholder="Customer name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-1 bg-[#23272f] text-white"
        />
      </div>

      {/* CUSTOMER ORDER LIST */}
      {Object.entries(customerMap)
        .filter(([_, c]) => c.name && c.name.toLowerCase().includes(search.toLowerCase()))
        .map(([customerId, cust]) => (
          <div key={customerId} className="bg-[#23272f] p-4 mt-4 rounded">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold">{cust.name}</h2>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={() => handleDelete(customerId)}>
                  🗑️ Delete
                </Button>
                <Button onClick={() => handleEdit(customerId)}>✏️ Edit</Button>
              </div>
            </div>
            {(cust.orders || []).map((order) => (
              <div
                key={order.orderId}
                className="mb-2 text-sm border-b border-gray-600 pb-2"
              >
                <div className="mb-1">
                  <strong>{mealLabels[order.mealType]}</strong> | {toDDMMYYYY(order.date)}
                </div>
                <ul className="list-disc ml-4">
                  {(order.items || []).map((i, idx) => (
                    <li key={idx}>
                      {i.name} - ₹{i.price} x {i.quantity} = ₹{i.price * i.quantity}
                    </li>
                  ))}
                </ul>
                <div className="text-sm mt-1">Delivery: ₹{order.deliveryCharges}</div>
                <div className="text-sm font-bold">Total: ₹{order.grandTotal}</div>
              </div>
            ))}
          </div>
        ))}

      {/* EDIT MODAL */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-[#23272f] text-white max-h-screen overflow-y-scroll">
          <h2 className="text-lg font-bold mb-3">
            Edit Orders - {editingCustomer?.name}
          </h2>

          {["breakfast", "lunch", "dinner", "bakery"].map((mealKey) => {
            const ordersForMeal = editingOrders.filter((o) => o.mealType === mealKey);
            if (ordersForMeal.length === 0) return null;

            return (
              <div key={mealKey} className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-xl capitalize">{mealLabels[mealKey]}</h3>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Are you sure you want to delete ALL ${mealLabels[mealKey]} orders for "${editingCustomer?.name}"?`
                        )
                      ) {
                        handleDeleteAllMealOrders(mealKey);
                      }
                    }}
                  >
                    🗑️ Delete All {mealLabels[mealKey]} Orders
                  </Button>
                </div>

                {ordersForMeal.map((order) => (
                  <div key={order.orderId} className="mb-4 border-b border-gray-600 pb-4">
                    <div className="mb-3">
                      <Label>Meal Type</Label>
                      <select
                        value={order.mealType}
                        onChange={(e) => handleOrderFieldChange(order.orderId, "mealType", e.target.value)}
                        className="bg-[#1f2937] text-white p-1 rounded"
                      >
                        <option value="breakfast">Breakfast</option>
                        <option value="lunch">Lunch</option>
                        <option value="dinner">Dinner</option>
                        <option value="bakery">Bakery</option>
                      </select>
                    </div>

                    <div className="mb-3">
                      <Label>Order Date</Label>
                      <Input
                        type="date"
                        value={order.date}
                        onChange={(e) => handleOrderFieldChange(order.orderId, "date", e.target.value)}
                        className="bg-[#1f2937] text-white mt-1"
                      />
                    </div>

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
                                min={0}
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
                                min={0}
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
                                title="Remove item"
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

                    <div className="mt-4">
                      <Label>Delivery Charges</Label>
                      <Input
                        type="number"
                        min={0}
                        value={order.deliveryCharges}
                        onChange={(e) => handleDeliveryChange(order.orderId, e.target.value)}
                        className="bg-[#1f2937] text-white mt-1"
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

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
