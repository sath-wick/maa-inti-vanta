import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { format } from "date-fns";
import { database, auth } from "./firebase";
import { ref, onValue, update, set } from "firebase/database";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./Login";
import MealTypeCards from "./MealTypeCards";
import InventoryModal from "./InventoryModal";

const subcategories = ["daal", "curry", "pickle", "sambar", "others"];

export default function MenuCreator() {
  const [inventory, setInventory] = useState({
    breakfast: [],
    lunchDinner: {},
    bakery: [],
  });

  const [selected, setSelected] = useState({
    breakfast: [],
    lunch: {},
    dinner: {},
    bakery: [],
  });

  const [customMenu, setCustomMenu] = useState({
    title: "Custom Menu",
    teluguTitle: "",
    deliveryFrom: "",
    deliveryTo: "",
    orderByFrom: "",
    orderByTo: "",
    items: [],
  });

  const [deliveryDate, setDeliveryDate] = useState("");
  const [billTeluguMeals, setBillTeluguMeals] = useState("");
  const [billEnglishMeals, setBillEnglishMeals] = useState("");
  const [billBakery, setBillBakery] = useState("");
  const [billCustom, setBillCustom] = useState("");
  const [user, setUser] = useState(null);

  const [showInventoryEditor, setShowInventoryEditor] = useState(false);
  const [editableInventory, setEditableInventory] = useState({
    breakfast: [],
    lunchDinner: {},
    bakery: [],
  });

  useEffect(() => {
    const invRef = ref(database, "inventory");
    onValue(invRef, (snapshot) => {
      const data = snapshot.val() || {};
      if (!Array.isArray(data.breakfast)) data.breakfast = [];
      if (!data.lunchDinner) data.lunchDinner = {};
      if (!Array.isArray(data.bakery)) data.bakery = [];
      setInventory(data);
    });
  }, []);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  function formatTo12Hour(time24) {
  if (!time24) return "";
  const [hourStr, minute] = time24.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${ampm}`;
}

  const copyToClipboard = async (text) => {
    await navigator.clipboard.writeText(text);
  };

  const addItem = (meal, value) => {
    if (meal === "breakfast" || meal === "bakery") {
      const item = inventory[meal].find((i) => i.name === value);
      if (item && !selected[meal].some((i) => i.name === value)) {
        setSelected((prev) => ({ ...prev, [meal]: [...prev[meal], item] }));
      }
    } else {
      const [sub, name] = value.split("::");
      const item = inventory.lunchDinner?.[sub]?.find((i) => i.name === name);
      if (item && !(selected[meal]?.[sub]?.some((i) => i.name === name))) {
        setSelected((prev) => ({
          ...prev,
          [meal]: { ...prev[meal], [sub]: [...(prev[meal]?.[sub] || []), item] },
        }));
      }
    }
  };

  const removeItem = (meal, sub, name) => {
    if (meal === "breakfast" || meal === "bakery") {
      setSelected((prev) => ({ ...prev, [meal]: prev[meal].filter((i) => i.name !== name) }));
    } else {
      setSelected((prev) => ({
        ...prev,
        [meal]: { ...prev[meal], [sub]: prev[meal][sub].filter((i) => i.name !== name) },
      }));
    }
  };

  const flattenLunchDinner = (mealObj) =>
    subcategories.flatMap((sub) => mealObj[sub] || []);

  const formatEnglishSection = (emoji, title, items, deadline, dateLabel) => {
    const allItems = Object.values(items).flat();
    if (allItems.length === 0) return "";
    const lines = Object.entries(items)
      .map(([sub, arr]) =>
        arr.map((i) => `- ${i.name}${i.price ? ` - ₹${i.price}` : ""}`).join("\n")
      )
      .join("\n");
    return `\n${emoji} *${title}*\n${lines}\n\n🕒 *Order by:*\n ${deadline} – ${dateLabel}\n━━━━━━━━━━━━━━━`;
  };

  const formatTeluguSection = (emoji, title, items, deadline, dateLabel) => {
    const allItems = Object.values(items).flat();
    if (allItems.length === 0) return "";
    const lines = Object.entries(items)
      .map(([sub, arr]) =>
        arr.map((i) => `- ${i.telugu || i.name}${i.price ? ` - ₹${i.price}` : ""}`).join("\n")
      )
      .join("\n");
    return `\n${emoji} ${title}\n${lines}\n\n🕒 ఆర్డర్ గడువు:\n ${deadline} – ${dateLabel}\n━━━━━━━━━━━━━━━`;
  };

  const generateMessageAndSaveMenu = async () => {
  const deliveryDay = format(new Date(deliveryDate), "dd/MMMM/yyyy");
  const orderByDay = format(
  new Date(new Date(deliveryDate).setDate(new Date(deliveryDate).getDate() + 1)),
  "dd/MMMM/yyyy"
  )

  const teluguMealsMsg =
    `🍲 మా ఇంటి వంట మీకు!\n\n📅 డెలివరీ తేదీ:\n ${deliveryDay}` +
    formatTeluguSection("🌞", "టిఫిన్", { breakfast: selected.breakfast }, "08:30 AM", orderByDay) +
    formatTeluguSection("🍚", "మధ్యాహ్న భోజనం", selected.lunch, "09:00 AM", orderByDay) +
    formatTeluguSection("🌙", "రాత్రి భోజనం", selected.dinner, "05:00 PM", orderByDay) +
    `\n\n🚚 డెలివరీ సమయాలు:\n🌞 టిఫిన్: 07:30 - 08:30 AM\n🍚 మధ్యాహ్న భోజనం: 12:30 - 01:30 PM\n🌙 రాత్రి భోజనం: 08:00 - 09:00 PM\n\n📦 డెలివరీ ఛార్జీలు:\n3 కి.మీ లోపు – ₹30\n3 కి.మీ - 6 కి.మీ – ₹60\n\nధన్యవాదాలు!`;

  const englishMealsMsg =
    `🍽️ *Maa Inti Vanta - just for you*\n\n📅 *Delivery Date:*\n ${deliveryDay}` +
    formatEnglishSection("🌞", "Breakfast", { breakfast: selected.breakfast }, "08:30 AM", orderByDay) +
    formatEnglishSection("🍚", "Lunch", selected.lunch, "09:00 AM", orderByDay) +
    formatEnglishSection("🌙", "Dinner", selected.dinner, "05:00 PM", orderByDay) +
    `\n\n🚚 *Delivery Timings:*\n🌞Breakfast: 07:30 - 08:30 AM\n🍚Lunch: 12:30 - 01:30 PM\n🌙Dinner: 08:00 - 09:00 PM\n\n📦 *Delivery Charges:*\n3 KM – ₹30\n3 KM - 6 KM – ₹60\n\nThank You!`;
orderByDay
  const bakeryMsg =
    `🍽 Maa Inti Vanta - just for you\n📅 Delivery Date: ${deliveryDay}` +
    formatEnglishSection("🍰", "Bakery", { bakery: selected.bakery }, "04:00 PM", orderByDay) +
    formatTeluguSection("🍰", "బేకరీ", { bakery: selected.bakery }, "04:00 PM", orderByDay) +
    `\n🚚 Delivery Timings/డెలివరీ సమయాలు:\n🍰Bakery: 06:30 PM\n🍰 బేకరీ: 06:30 PM`;

  const customMenuItemsFiltered = customMenu.items.filter(
    (item) => item.name.trim() && item.price
  );

  let customMsg = "";
  if (customMenuItemsFiltered.length > 0) {
    const deliveryFrom = formatTo12Hour(customMenu.deliveryFrom);
    const deliveryTo = formatTo12Hour(customMenu.deliveryTo);
    const deliveryTimes = deliveryFrom && deliveryTo ? `${deliveryFrom} - ${deliveryTo}` : "Not specified";

    const orderBy = formatTo12Hour(customMenu.orderBy) || "Not specified";

    const customEnglishLines = customMenuItemsFiltered
      .map((i) => `- ${i.name} - ₹${i.price}`)
      .join("\n");
    const customTeluguLines = customMenuItemsFiltered
      .map((i) => `- ${i.telugu || i.name} - ₹${i.price}`)
      .join("\n");

    customMsg =
      `🍽 *Maa Inti Vanta - just for you*\n📅 *Delivery Date: ${deliveryDay}*\n` +
      `✨ ${customMenu.title}\n${customEnglishLines}\n\n🕒 *Order By:* ${orderBy}` +
      `\n━━━━━━━━━━━━━━━\n` +
      `✨ ${customMenu.teluguTitle || customMenu.title}\n${customTeluguLines}\n\n*🕒 ఆర్డర్ గడువు:* ${orderBy}` +
      `\n\n🚚 Delivery Timings/డెలివరీ సమయాలు:\n${deliveryTimes}`;
  }

  setBillTeluguMeals(teluguMealsMsg);
  setBillEnglishMeals(englishMealsMsg);
  setBillBakery(bakeryMsg);
  setBillCustom(customMsg);

  if (!auth.currentUser) {
    alert("❌ Please login to save menu.");
    return;
  }

  const menuRef = ref(database, `menus/${deliveryDate}`);

  const menuData = {
    breakfast: selected.breakfast.map(({ name, price }) => ({ name, price })),
    bakery: selected.bakery.map(({ name, price }) => ({ name, price })),
    lunch: flattenLunchDinner(selected.lunch).map(({ name, price }) => ({ name, price })),
    dinner: flattenLunchDinner(selected.dinner).map(({ name, price }) => ({ name, price })),
  };

  if (customMenuItemsFiltered.length > 0) {
    menuData[customMenu.title.toLowerCase().replace(/\s+/g, "_")] = customMenuItemsFiltered.map(item => ({
      name: item.name,
      telugu: item.telugu,
      price: Number(item.price),
    }));
    menuData[`${customMenu.title.toLowerCase().replace(/\s+/g, "_")}_deliveryFrom`] = customMenu.deliveryFrom || "";
    menuData[`${customMenu.title.toLowerCase().replace(/\s+/g, "_")}_deliveryTo`] = customMenu.deliveryTo || "";
    menuData[`${customMenu.title.toLowerCase().replace(/\s+/g, "_")}_orderBy`] = customMenu.orderBy || "";
  }

  await update(menuRef, menuData);
  setSelected({ breakfast: [], lunch: {}, dinner: [], bakery: [] });
  setCustomMenu({ title: "Custom Menu", teluguTitle: "", items: [], deliveryFrom: "", deliveryTo: "", orderBy: "" });
  alert("✅ Menu generated and saved for " + deliveryDate);
};


  const openInventoryEditor = () => {
    const copy = JSON.parse(JSON.stringify(inventory));
    if (!Array.isArray(copy.breakfast)) copy.breakfast = [];
    if (!copy.lunchDinner) copy.lunchDinner = {};
    if (!Array.isArray(copy.bakery)) copy.bakery = [];
    setEditableInventory(copy);
    setShowInventoryEditor(true);
  };


  const updateNestedItem = (tab, sub, idx, field, val) => {
    const copy = { ...editableInventory };
    if (tab === "breakfast" || tab === "bakery") {
      copy[tab][idx][field] = val;
    } else {
      copy.lunchDinner[sub][idx][field] = val;
    }
    setEditableInventory(copy);
  };


  const addNestedItem = (tab, sub) => {
    const copy = { ...editableInventory };
    if (tab === "breakfast" || tab === "bakery") {
      copy[tab].push({ name: "", telugu: "", price: 0 });
    } else {
      if (!copy.lunchDinner[sub]) copy.lunchDinner[sub] = [];
      copy.lunchDinner[sub].push({ name: "", telugu: "", price: 0 });
    }
    setEditableInventory(copy);
  };


  const deleteNestedItem = (tab, sub, idx) => {
    const copy = { ...editableInventory };
    if (tab === "breakfast" || tab === "bakery") {
      copy[tab].splice(idx, 1);
    } else {
      copy.lunchDinner[sub].splice(idx, 1);
    }
    setEditableInventory(copy);
  };


  const saveInventoryToFirebase = async () => {
    if (!auth.currentUser) {
      alert("Please login to save changes.");
      return;
    }
    const invRef = ref(database, "inventory");
    await set(invRef, editableInventory);
    setInventory(editableInventory);
    setShowInventoryEditor(false);
  };


  if (!user) return <Login />;


  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Menu Creation</h1>
        <Button variant="outline" onClick={() => signOut(auth)}>
          Logout
        </Button>
      </div>

      <div>
        <Label>Delivery Date</Label>
        <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
      </div>

      {deliveryDate && (
        <MealTypeCards
          inventory={inventory}
          selected={selected}
          customMenu={customMenu}
          setCustomMenu={setCustomMenu}
          addItem={addItem}
          removeItem={removeItem}
          handleCustomChange={(idx, field, value) => {
            const updated = [...customMenu.items];
            updated[idx][field] = value;
            setCustomMenu((prev) => ({ ...prev, items: updated }));
          }}
          addCustomItem={() =>
            setCustomMenu((prev) => ({
              ...prev,
              items: [...prev.items, { name: "", telugu: "", price: "" }],
            }))
          }
          removeCustomItem={(idx) => {
            const updated = [...customMenu.items];
            updated.splice(idx, 1);
            setCustomMenu((prev) => ({ ...prev, items: updated }));
          }}
        />
      )}

      <Button className="mt-4" onClick={generateMessageAndSaveMenu}>
        Generate Message & Save Menu
      </Button>

      <Button variant="outline" onClick={openInventoryEditor} className="mt-4">
        Edit Inventory
      </Button>

      {(billTeluguMeals || billEnglishMeals || billBakery || billCustom) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {billTeluguMeals && (
            <div>
              <Label>Telugu Meals</Label>
              <Textarea value={billTeluguMeals} rows={16} readOnly />
              <Button className="mt-2" onClick={() => copyToClipboard(billTeluguMeals)}>
                📋 Copy Telugu Meals
              </Button>
            </div>
          )}
          {billEnglishMeals && (
            <div>
              <Label>English Meals</Label>
              <Textarea value={billEnglishMeals} rows={16} readOnly />
              <Button className="mt-2" onClick={() => copyToClipboard(billEnglishMeals)}>
                📋 Copy English Meals
              </Button>
            </div>
          )}
          {billBakery && (
            <div>
              <Label>Bakery (Telugu + English)</Label>
              <Textarea value={billBakery} rows={16} readOnly />
              <Button className="mt-2" onClick={() => copyToClipboard(billBakery)}>
                📋 Copy Bakery
              </Button>
            </div>
          )}
          {billCustom && (
            <div>
              <Label>Custom Menu (Telugu + English)</Label>
              <Textarea value={billCustom} rows={16} readOnly />
              <Button className="mt-2" onClick={() => copyToClipboard(billCustom)}>
                📋 Copy Custom
              </Button>
            </div>
          )}
        </div>
      )}

      <InventoryModal
        open={showInventoryEditor}
        onOpenChange={setShowInventoryEditor}
        inventory={editableInventory}
        onSave={saveInventoryToFirebase}
        onChange={updateNestedItem}
        onAddItem={addNestedItem}
        onDeleteItem={deleteNestedItem}
      />
    </div>
  );
}
