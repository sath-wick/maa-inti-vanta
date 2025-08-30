import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const subcategories = ["daal", "curry", "pickle", "sambar", "others"];

export default function InventoryModal({
  open,
  onOpenChange,
  inventory,
  onSave,
  onChange,
  onAddItem,
  onDeleteItem,
}) {
  const [currentTab, setCurrentTab] = useState("breakfast");

  const updateNestedItem = (tab, sub, idx, field, value) => {
    onChange(tab, sub, idx, field, value);
  };

  const addNestedItem = (tab, sub) => {
    onAddItem(tab, sub);
  };

  const deleteNestedItem = (tab, sub, idx) => {
    onDeleteItem(tab, sub, idx);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <h2 className="text-xl font-bold mb-4">Edit Inventory</h2>
        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <TabsList>
            <TabsTrigger value="breakfast">Breakfast</TabsTrigger>
            <TabsTrigger value="lunchDinner">Lunch & Dinner</TabsTrigger>
            <TabsTrigger value="bakery">Bakery</TabsTrigger>
          </TabsList>

          <TabsContent value="breakfast">
            {(inventory.breakfast ?? []).map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <Input
                  value={item.name}
                  onChange={(e) => updateNestedItem("breakfast", "", idx, "name", e.target.value)}
                  placeholder="English Name"
                />
                <Input
                  value={item.telugu}
                  onChange={(e) => updateNestedItem("breakfast", "", idx, "telugu", e.target.value)}
                  placeholder="Telugu Name"
                />
                <Input
                  type="number"
                  value={item.price}
                  onChange={(e) => updateNestedItem("breakfast", "", idx, "price", e.target.value)}
                  placeholder="₹"
                />
                <Button variant="destructive" onClick={() => deleteNestedItem("breakfast", "", idx)}>Delete</Button>
              </div>
            ))}
            <Button onClick={() => addNestedItem("breakfast", "")}>Add Item</Button>
          </TabsContent>

          <TabsContent value="lunchDinner">
            {subcategories.map((sub) => (
              <div key={sub} className="mb-4">
                <h3 className="font-semibold capitalize">{sub}</h3>
                {(inventory.lunchDinner?.[sub] ?? []).map((item, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <Input
                      value={item.name}
                      onChange={(e) => updateNestedItem("lunchDinner", sub, idx, "name", e.target.value)}
                      placeholder="English Name"
                    />
                    <Input
                      value={item.telugu}
                      onChange={(e) => updateNestedItem("lunchDinner", sub, idx, "telugu", e.target.value)}
                      placeholder="Telugu Name"
                    />
                    <Input
                      type="number"
                      value={item.price}
                      onChange={(e) => updateNestedItem("lunchDinner", sub, idx, "price", e.target.value)}
                      placeholder="₹"
                    />
                    <Button variant="destructive" onClick={() => deleteNestedItem("lunchDinner", sub, idx)}>Delete</Button>
                  </div>
                ))}
                <Button onClick={() => addNestedItem("lunchDinner", sub)}>Add Item</Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="bakery">
            {(inventory.bakery ?? []).map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <Input
                  value={item.name}
                  onChange={(e) => updateNestedItem("bakery", "", idx, "name", e.target.value)}
                  placeholder="English Name"
                />
                <Input
                  value={item.telugu}
                  onChange={(e) => updateNestedItem("bakery", "", idx, "telugu", e.target.value)}
                  placeholder="Telugu Name"
                />
                <Input
                  type="number"
                  value={item.price}
                  onChange={(e) => updateNestedItem("bakery", "", idx, "price", e.target.value)}
                  placeholder="₹"
                />
                <Button variant="destructive" onClick={() => deleteNestedItem("bakery", "", idx)}>Delete</Button>
              </div>
            ))}
            <Button onClick={() => addNestedItem("bakery", "")}>Add Item</Button>
          </TabsContent>
        </Tabs>
        <div className="mt-4 flex gap-2">
          <Button onClick={onSave} className="bg-green-600">Save</Button>
          <Button onClick={() => onOpenChange(false)} className="bg-gray-600">Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
