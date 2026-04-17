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
        imageSrc: ''
      }
    ]);
  };

  const removeVariant = (id: string) => {
    setVariants(variants.filter(v => v.id !== id));
  };

  const updateVariant = (id: string, field: keyof Variant, value: string) => {
    setVariants(variants.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-base font-semibold flex items-center">
          <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-xs mr-2">4</span>
          Variants
        </h2>
        <button
          onClick={addVariant}
          className="flex items-center px-3 py-1.5 bg-zinc-100 text-zinc-900 rounded-full text-xs font-medium hover:bg-zinc-200 transition-colors"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Variant
        </button>
      </div>

      {variants.length === 0 ? (
        <div className="text-center py-8 bg-zinc-50 rounded-2xl border border-zinc-100 border-dashed">
          <p className="text-sm text-zinc-500 mb-3">No variants added yet.</p>
          <button
            onClick={addVariant}
            className="btn-secondary mx-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add First Variant
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Opt 1 Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Opt 1 Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Opt 2 Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Opt 2 Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Image URL</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-100">
              {variants.map((variant) => (
                <tr key={variant.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-4 py-2">
                    <input type="text" value={variant.option1Name} onChange={e => updateVariant(variant.id, 'option1Name', e.target.value)} className="w-full bg-transparent border-0 border-b border-transparent hover:border-zinc-200 focus:border-zinc-900 focus:ring-0 text-sm px-0 py-1 transition-colors" placeholder="e.g. Color" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="text" value={variant.option1Value} onChange={e => updateVariant(variant.id, 'option1Value', e.target.value)} className="w-full bg-transparent border-0 border-b border-transparent hover:border-zinc-200 focus:border-zinc-900 focus:ring-0 text-sm px-0 py-1 transition-colors font-medium" placeholder="e.g. Red" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="text" value={variant.option2Name} onChange={e => updateVariant(variant.id, 'option2Name', e.target.value)} className="w-full bg-transparent border-0 border-b border-transparent hover:border-zinc-200 focus:border-zinc-900 focus:ring-0 text-sm px-0 py-1 transition-colors" placeholder="e.g. Size" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="text" value={variant.option2Value} onChange={e => updateVariant(variant.id, 'option2Value', e.target.value)} className="w-full bg-transparent border-0 border-b border-transparent hover:border-zinc-200 focus:border-zinc-900 focus:ring-0 text-sm px-0 py-1 transition-colors font-medium" placeholder="e.g. Large" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="text" value={variant.sku} onChange={e => updateVariant(variant.id, 'sku', e.target.value)} className="w-full bg-transparent border-0 border-b border-transparent hover:border-zinc-200 focus:border-zinc-900 focus:ring-0 text-sm px-0 py-1 transition-colors font-mono text-xs" placeholder="SKU" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="text" value={variant.price} onChange={e => updateVariant(variant.id, 'price', e.target.value)} className="w-full bg-transparent border-0 border-b border-transparent hover:border-zinc-200 focus:border-zinc-900 focus:ring-0 text-sm px-0 py-1 transition-colors font-mono" placeholder="0.00" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="text" value={variant.imageSrc} onChange={e => updateVariant(variant.id, 'imageSrc', e.target.value)} className="w-full bg-transparent border-0 border-b border-transparent hover:border-zinc-200 focus:border-zinc-900 focus:ring-0 text-sm px-0 py-1 transition-colors font-mono text-xs" placeholder="https://..." />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => removeVariant(variant.id)} className="text-zinc-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50" title="Remove Variant">
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
