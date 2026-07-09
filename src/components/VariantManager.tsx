// Changes: Auto-sync 大货 REG SKU when size changes; supports xxx-REG-size format.
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Variant } from '../utils/csvExport';
import { buildBulkSku, parseBulkSku } from '../utils/podPricing';

interface VariantManagerProps {
  variants: Variant[];
  setVariants: React.Dispatch<React.SetStateAction<Variant[]>>;
  productCode?: string;
}

export const VariantManager: React.FC<VariantManagerProps> = ({
  variants,
  setVariants,
  productCode = '',
}) => {
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
    setVariants(
      variants.map((v) => {
        if (v.id !== id) return v;
        const updated = { ...v, [field]: value };
        if (field === 'option1Value' && /-REG-/.test(v.sku)) {
          const { productCode: pc, subCode } = parseBulkSku(v.sku);
          const size = value === 'Default' ? '' : value;
          updated.sku = buildBulkSku(pc || productCode, size, subCode);
        }
        return updated;
      })
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-base font-semibold flex items-center text-zinc-900">
          <span className="studio-step">4</span>
          Variants
        </h2>
        <button
          onClick={addVariant}
          className="flex items-center px-3 py-1.5 bg-zinc-100 border border-zinc-200 text-zinc-700 rounded-xl text-xs font-medium hover:bg-zinc-200 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Variant
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Option 1</th>
              <th className="px-4 py-3 text-left font-medium">Value</th>
              <th className="px-4 py-3 text-left font-medium">SKU</th>
              <th className="px-4 py-3 text-left font-medium">Price</th>
              <th className="px-4 py-3 text-left font-medium">Compare</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {variants.map((variant) => (
              <tr key={variant.id} className="hover:bg-zinc-50/50">
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={variant.option1Name}
                    onChange={(e) => updateVariant(variant.id, 'option1Name', e.target.value)}
                    className="input-modern text-xs py-1.5"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={variant.option1Value}
                    onChange={(e) => updateVariant(variant.id, 'option1Value', e.target.value)}
                    className="input-modern text-xs py-1.5"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={variant.sku}
                    onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)}
                    className="input-modern text-xs py-1.5 font-mono"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={variant.price}
                    onChange={(e) => updateVariant(variant.id, 'price', e.target.value)}
                    className="input-modern text-xs py-1.5 font-mono"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={variant.compareAtPrice}
                    onChange={(e) => updateVariant(variant.id, 'compareAtPrice', e.target.value)}
                    className="input-modern text-xs py-1.5 font-mono"
                  />
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => removeVariant(variant.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
