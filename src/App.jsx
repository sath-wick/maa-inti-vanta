// src/components/ui/app.jsx
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { format } from "date-fns";
import { database, auth } from "./firebase";
import { ref, onValue, set } from "firebase/database";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./Login";

export default function MenuCreator() {
  const [inventory, setInventory] = useState({ breakfast: [], lunch: {}, dinner: {} });
  const [selected, setSelected] = useState({ breakfast: [], lunch: {}, dinner: {} });
const [deliveryDate, setDeliveryDate] = useState(format(new Date(), "yyyy-MMMM-dd"));
  const [generatedMsg, setGeneratedMsg] = useState("");
  const [generatedTeluguMsg, setGeneratedTeluguMsg] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [currentMeal, setCurrentMeal] = useState("breakfast");
  const [editableInventory, setEditableInventory] = useState({ breakfast: [], lunch: {}, dinner: {} });
  const [user, setUser] = useState(null);

  const subcategories = ["daal", "curry", "pickle", "sambar", "others"];

  useEffect(() => {
    const invRef = ref(database, "inventory");
    onValue(invRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setInventory(data);
    });
  }, []);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  const addItem = (meal, value) => {
    const [sub, name] = value.split("::");
    const itemObj = inventory[meal]?.[sub]?.find(i => i.name === name);
    if (itemObj && !selected[meal]?.[sub]?.some(i => i.name === name)) {
      setSelected(prev => ({
        ...prev,
        [meal]: {
          ...prev[meal],
          [sub]: [...(prev[meal]?.[sub] ?? []), itemObj]
        }
      }));
    }
  };

  const removeItem = (meal, sub, name) => {
    setSelected(prev => ({
      ...prev,
      [meal]: {
        ...prev[meal],
        [sub]: prev[meal][sub].filter(i => i.name !== name)
      }
    }));
  };

  const updateNestedItem = (meal, sub, index, field, value) => {
    const copy = { ...editableInventory };
    if (meal === "breakfast") {
      copy.breakfast[index][field] = value;
    } else {
      copy[meal][sub][index][field] = value;
    }
    setEditableInventory(copy);
  };

  const addNestedItem = (meal, sub) => {
    const copy = { ...editableInventory };
    if (meal === "breakfast") {
      copy.breakfast.push({ name: "", telugu: "" });
    } else {
      if (!copy[meal][sub]) copy[meal][sub] = [];
      copy[meal][sub].push({ name: "", telugu: "" });
    }
    setEditableInventory(copy);
  };

  const deleteNestedItem = (meal, sub, index) => {
    const copy = { ...editableInventory };
    if (meal === "breakfast") {
      copy.breakfast.splice(index, 1);
    } else {
      copy[meal][sub].splice(index, 1);
    }
    setEditableInventory(copy);
  };

  const generateMessage = () => {
  const deliveryDay = format(new Date(deliveryDate), "dd/MMMM/yyyy");

  const to12Hour = (time24) => {
    const [hour, minute] = time24.split(":");
    const date = new Date();
    date.setHours(parseInt(hour), parseInt(minute));
    return format(date, "hh:mm a");
  };

  const formatEnglishSection = (emoji, title, items, deadline, dateLabel) => {
    const lines = Object.entries(items)
      .map(([sub, arr]) =>
        arr.map(i =>
          `- ${i.name}${i.price ? ` - ₹${i.price}` : ""}`
        ).join("\n")
      ).join("\n") || "- No items selected";

    return `\n${emoji} *${title}*\n${lines}\n\n🕒 *Order by:*\n ${to12Hour(deadline)} – ${dateLabel}\n━━━━━━━━━━━━━━━`;
  };

  const formatTeluguSection = (emoji, title, items, deadline, dateLabel) => {
    const lines = Object.entries(items)
      .map(([sub, arr]) =>
        arr.map(i =>
          `- ${i.telugu || i.name}${i.price ? ` - ₹${i.price}` : ""}`
        ).join("\n")
      ).join("\n") || "- ఎంపిక చేయలేదు";

    return `\n${emoji} ${title}\n${lines}\n\n🕒 *ఆర్డర్ గడువు:*\n ${to12Hour(deadline)} – ${dateLabel}\n━━━━━━━━━━━━━━━\n`;
  };

  const englishMsg =
    `🍽️ *Our cooked meal, just for you!*\n\n` +
    `Please select the items you'd like to receive.\n📅 *Delivery Date:*\n ${deliveryDay}` +
    formatEnglishSection("🌞", "Breakfast", { breakfast: selected.breakfast }, "10:00PM", format(new Date(new Date(deliveryDate).setDate(new Date(deliveryDate).getDate() - 1)), "dd/MMMM/yyyy")) +
    formatEnglishSection("🍚", "Lunch", selected.lunch, "08:00AM", deliveryDay) +
    formatEnglishSection("🌙", "Dinner", selected.dinner, "03:00PM", deliveryDay) +
    `\n\n🚚 *Delivery Timings:*\n🌞Breakfast: 08:30 - 09:30 AM\n🍚Lunch: 12:30 - 01:30 PM\n🌙Dinner: 07:30 - 08:30 PM\n\n` +
    `📦 *Delivery Charges:*\nWithin 3 Km – ₹30\n3 Km to 6 Km – ₹60\n\nThank you!`;

  const teluguMsg =
    `🍲 మీ కోసం – *మా ఇంటి వంట!*\n\n` +
    `దయచేసి మీకు కావాల్సిన వంటలు ఎంచుకోండి.\n\n📅 *డెలివరీ తేదీ:*\n *${deliveryDay}*\n` +
    formatTeluguSection("🌞", "*టిఫిన్*", { breakfast: selected.breakfast },  "10:00PM", format(new Date(new Date(deliveryDate).setDate(new Date(deliveryDate).getDate() - 1)), "dd/MMMM/yyyy")) +
    formatTeluguSection("🍚", "*మధ్యాహ్న భోజనం*", selected.lunch, "08:00AM", deliveryDay) +
    formatTeluguSection("🌙", "*రాత్రి భోజనం*", selected.dinner, "03:00PM", deliveryDay) +
    `\n\n🚚 *డెలివరీ సమయం*:\n🌞టిఫిన్: 08:30 - 09:30 AM\n🍚మధ్యాహ్న భోజనం: 12:30 - 01:30 PM\n🌙రాత్రి భోజనం: 07:30 - 08:30 PM\n\n` +
    `*డెలివరి ఛార్జ్ (3 Km లోపు): ₹30 రూపాయలు*.\n*డెలివరి ఛార్జ్ (3 Km - 6 Km): ₹60 రూపాయలు*\n\n` +
    `ధన్యవాదాలు`;

  setGeneratedMsg(englishMsg);
  setGeneratedTeluguMsg(teluguMsg);
};


  const saveToFirebase = async () => {
    if (!auth.currentUser) {
      alert("❌ Please login to save changes.");
      return;
    }

    const copy = { ...editableInventory };
    if (!Array.isArray(copy.breakfast)) {
      copy.breakfast = [];
    }
    const invRef = ref(database, "inventory");
    await set(invRef, copy);
    setInventory(copy);
    setShowEditor(false);
    alert("✅ Changes saved successfully!");
  };

  if (!user) return <Login onSuccess={() => alert("✅ Logged in successfully!")} />;

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Menu Creation</h1>
        <Button variant="outline" onClick={() => signOut(auth)}>Logout</Button>
      </div>
      <div>
        <Label>Delivery Date</Label>
        <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["breakfast", "lunch", "dinner"].map(meal => (
          <Card key={meal} className="bg-gray-800 border border-gray-700 text-gray-100">
            <CardContent className="space-y-2 p-4">
              <h2 className="text-xl font-semibold capitalize">{meal}</h2>
              {meal === "lunch" || meal === "dinner" ? (
                subcategories.map(sub => (
                  <div key={sub}>
                    <Label>Select {sub.charAt(0).toUpperCase() + sub.slice(1)}</Label>
                    <select
                      className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2"
                      onChange={(e) => addItem(meal, e.target.value)}
                      value=""
                    >
                      <option disabled value="">-- select item --</option>
                      {(inventory[meal]?.[sub] ?? []).map(item => (
                        <option key={item.name} value={`${sub}::${item.name}`}>{item.name}</option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(selected[meal]?.[sub] ?? []).map(item => (
                        <span
                          key={item.name}
                          className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-blue-500"
                          onClick={() => removeItem(meal, sub, item.name)}
                        >
                          {item.name} ×
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <Label>Select Items</Label>
                  <select
                  className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg p-2"
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    const item = inventory[meal].find(i => i.name === selectedName);
                    if (item && !selected[meal].some(i => i.name === selectedName)) {
                      setSelected(prev => ({
                        ...prev,
                        [meal]: [...prev[meal], item]
                      }));
                    }
                  }}
                  value=""
                >
                  <option disabled value="">-- select item --</option>
                  {(inventory[meal] ?? []).map(item => (
                    <option key={item.name} value={item.name}>{item.name}</option>
                  ))}
                </select>

                <div className="flex flex-wrap gap-2 mt-2">
                  {(selected[meal] ?? []).map(item => (
                    <span
                      key={item.name}
                      className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-blue-500"
                      onClick={() => setSelected(prev => ({
                        ...prev,
                        [meal]: prev[meal].filter(i => i.name !== item.name)
                      }))}
                    >
                      {item.name} ×
                    </span>
                  ))}
                </div>

                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={generateMessage}>Generate Message</Button>
      <Button variant="outline" onClick={() => {
        const copy = JSON.parse(JSON.stringify(inventory));
        if (!Array.isArray(copy.breakfast)) copy.breakfast = [];
        setEditableInventory(copy);
        setShowEditor(true);
      }}>Edit Inventory</Button>

      {generatedMsg && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label>English</Label>
            <Textarea value={generatedMsg} rows={16} readOnly />
          </div>
          <div>
            <Label>Telugu</Label>
            <Textarea value={generatedTeluguMsg} rows={16} readOnly />
          </div>
        </div>
      )}

      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent>
          <h2 className="text-xl font-bold mb-4">Edit Inventory</h2>
          <Tabs value={currentMeal} onValueChange={setCurrentMeal}>
            <TabsList>
              <TabsTrigger value="breakfast">Breakfast</TabsTrigger>
              <TabsTrigger value="lunch">Lunch</TabsTrigger>
              <TabsTrigger value="dinner">Dinner</TabsTrigger>
            </TabsList>
            {["breakfast", "lunch", "dinner"].map(meal => (
              <TabsContent key={meal} value={meal}>
                {meal === "lunch" || meal === "dinner" ? (
                  subcategories.map(sub => (
                    <div key={sub} className="space-y-2">
                      <h3 className="text-md font-semibold capitalize">{sub}</h3>
                      {(editableInventory[meal]?.[sub] ?? []).map((item, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input value={item.name} onChange={e => updateNestedItem(meal, sub, idx, "name", e.target.value)} placeholder="English" />
                          <Input value={item.telugu} onChange={e => updateNestedItem(meal, sub, idx, "telugu", e.target.value)} placeholder="తెలుగు" />
                          <Button variant="destructive" onClick={() => deleteNestedItem(meal, sub, idx)}>❌</Button>
                        </div>
                      ))}
                      <Button onClick={() => addNestedItem(meal, sub)}>➕ Add Item</Button>
                    </div>
                  ))
                ) : (
                  (editableInventory.breakfast ?? []).map((item, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <Input
                        value={item.name}
                        onChange={e => updateNestedItem("breakfast", "", idx, "name", e.target.value)}
                        placeholder="English"
                      />
                      <Input
                        value={item.telugu}
                        onChange={e => updateNestedItem("breakfast", "", idx, "telugu", e.target.value)}
                        placeholder="తెలుగు"
                      />
                      <Button variant="destructive" onClick={() => deleteNestedItem("breakfast", "", idx)}>❌</Button>
                    </div>
                  ))
                )}
                <Button onClick={() => addNestedItem("breakfast", "")}>➕ Add Item</Button>
              </TabsContent>
            ))}
          </Tabs>
          <Button className="mt-4" onClick={saveToFirebase}>💾 Save</Button>
          <Button variant="outline" className="mt-2" onClick={() => setShowEditor(false)}>❌ Cancel</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
