import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ref, set } from "firebase/database";
import { database } from "../../firebase";

export default function InventoryEditor({ open, onClose, inventory, onUpdate }) {
  const [localInventory, setLocalInventory] = useState(structuredClone(inventory));

  const handleAdd = (meal) => {
    setLocalInventory({
      ...localInventory,
      [meal]: [...localInventory[meal], { name: "", telugu: "" }]
    });
  };

  const handleChange = (meal, index, field, value) => {
    const updatedMeal = [...localInventory[meal]];
    updatedMeal[index][field] = value;
    setLocalInventory({ ...localInventory, [meal]: updatedMeal });
  };

  const handleRemove = (meal, index) => {
    const updatedMeal = [...localInventory[meal]];
    updatedMeal.splice(index, 1);
    setLocalInventory({ ...localInventory, [meal]: updatedMeal });
  };

  const handleSave = async () => {
    await set(ref(database, "inventory"), localInventory);
    onUpdate(localInventory); // update in parent
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <h2 className="text-xl font-bold mb-2">Edit Inventory</h2>
        {["breakfast", "lunch", "dinner"].map((meal) => (
          <div key={meal} className="mb-6">
            <h3 className="text-lg font-semibold capitalize mb-2">{meal}</h3>
            {localInventory[meal].map((item, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <Input
                  placeholder="English"
                  value={item.name}
                  onChange={(e) => handleChange(meal, index, "name", e.target.value)}
                />
                <Input
                  placeholder="Telugu"
                  value={item.telugu}
                  onChange={(e) => handleChange(meal, index, "telugu", e.target.value)}
                />
                <Button variant="destructive" onClick={() => handleRemove(meal, index)}>{"❌"}</Button>
              </div>
            ))}
            <Button onClick={() => handleAdd(meal)} className="mt-2">+ Add {meal} item</Button>
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
