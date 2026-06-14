// Changes: Unified dark studio theme for variant table editor.
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Variant } from '../utils/csvExport';

interface VariantManagerProps {
  variants: Variant[];
  setVariants: React.Dispatch<React.SetStateAction<Variant[]>>;
}

export const VariantManager: React.FC<VariantManagerProps> = ({ variants, setVariants }) => {
  const addVariant = () => {
    setVariants([
      ...variants,
      {
        id: Math.random().toString(36).substr(2, 9),
        option1Name: 'Color',
        option1Value: '',
        option2Name: '',
        option2Value: '',
        option3Name: '',
        option3Value: '',
        sku: '',
        price: '0.00',
        compareAtPrice: '',
        imageSrc: '',
      },
    ]);
  };

  const removeVariant = (id: string) => {
    setVariants(variants.filter((v) => v.id !== id));
  };

  const updateVariant = (id: string, field: keyof Variant, value: string) => {
    setVariants(variants.map((v) => (v.id === id ? { ...v, [field]: value } : v)));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-base font-semibold flex items-center text-slate-200">
          <span className="studio-step">4</span>
          Variants
        </h2>
        <button
          onClick={addVariant}
          className="flex items-center px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-medium hover:bg-slate-700 transition-colors"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Variant
        </button>
      </div>

      {variants.length === 0 ? (
        <div className="text-center py-8 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
          <p className="text-sm text-slate-500 mb-3">No variants added yet.</p>
          <button onClick={addVariant} className="btn-secondary mx-auto">
            <Plus className="w-4 h-4 mr-2" />
            Add First Variant
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Opt 1 Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Opt 1 Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Opt 2 Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Opt 2 Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Image URL</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="bg-slate-950/30 divide-y divide-slate-800">
              {variants.map((variant) => (
                <tr key={variant.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2">
                    <input type="text" value={variant.option1Name} onChange={(e) => updateVariant(variant.id, 'option1Name', e.target.value)} className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:ring-0 text-sm px-0 py-1 text-slate-200 transition-colors" placeholder="e.g. Color" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="text" value={variant.option1Value} onChange={(e) => updateVariant(variant.id, 'option1Value', e.target.value)} className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:ring-0 text-sm px-0 py-1 font-medium text-slate-100 transition-colors" placeholder="e.g. Red" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="text" value={variant.option2Name} onChange={(e) => updateVariant(variant.id, 'option2Name', e.target.value)} className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:ring-0 text-sm px-0 py-1 text-slate-200 transition-colors" placeholder="e.g. Size" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="text" value={variant.option2Value} onChange={(e) => updateVariant(variant.id, 'option2Value', e.target.value)} className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:ring-0 text-sm px-0 py-1 font-medium text-slate-100 transition-colors" placeholder="e.g. Large" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="text" value={variant.sku} onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)} className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:ring-0 text-sm px-0 py-1 font-mono text-xs text-slate-300 transition-colors" placeholder="SKU" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="text" value={variant.price} onChange={(e) => updateVariant(variant.id, 'price', e.target.value)} className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:ring-0 text-sm px-0 py-1 font-mono text-slate-200 transition-colors" placeholder="0.00" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="text" value={variant.imageSrc} onChange={(e) => updateVariant(variant.id, 'imageSrc', e.target.value)} className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:ring-0 text-sm px-0 py-1 font-mono text-xs text-slate-300 transition-colors" placeholder="https://..." />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => removeVariant(variant.id)} className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10" title="Remove Variant">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
