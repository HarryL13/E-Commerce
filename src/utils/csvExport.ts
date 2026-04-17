import Papa from 'papaparse';

export interface Variant {
  id: string;
  option1Name: string;
  option1Value: string;
  option2Name: string;
  option2Value: string;
  option3Name: string;
  option3Value: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  imageSrc: string;
}

export interface ProductData {
  title: string;
  handle: string;
  description_html: string;
  vendor: string;
  category: string;
  type: string;
  tags: string[];
  seo_title: string;
  seo_description: string;
  mainImageSrc: string;
}

export interface ExportItem {
  product: ProductData;
  variants: Variant[];
}

const CSV_HEADERS = [
  "Handle", "Title", "Body (HTML)", "Vendor", "Product Category", "Type", "Tags", "Published",
  "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value", "Option3 Name", "Option3 Value",
  "Variant SKU", "Variant Grams", "Variant Inventory Tracker", "Variant Inventory Qty", "Variant Inventory Policy",
  "Variant Fulfillment Service", "Variant Price", "Variant Compare At Price", "Variant Requires Shipping",
  "Variant Taxable", "Variant Barcode", "Image Src", "Image Position", "Image Alt Text", "Gift Card",
  "SEO Title", "SEO Description", "Google Shopping / Google Product Category", "Google Shopping / Gender",
  "Google Shopping / Age Group", "Google Shopping / MPN", "Google Shopping / Condition", "Google Shopping / Custom Product",
  "Variant Image", "Variant Weight Unit", "Variant Tax Code", "Cost per item",
  "Included / United States", "Price / United States", "Compare At Price / United States",
  "Included / International", "Price / International", "Compare At Price / International", "Status"
];

export const exportCSV = (items: ExportItem[], filename: string = 'products') => {
  const rows: Record<string, string>[] = [];
  
  items.forEach(({ product, variants }) => {
    const variantsToExport = variants.length > 0 ? variants : [{
      id: 'default',
      option1Name: 'Title',
      option1Value: 'Default Title',
      option2Name: '',
      option2Value: '',
      option3Name: '',
      option3Value: '',
      sku: product.handle,
      price: '0.00',
      compareAtPrice: '',
      imageSrc: ''
    }];

    variantsToExport.forEach((variant, index) => {
      const row: Record<string, string> = {};
      
      // Initialize all headers with empty string
      CSV_HEADERS.forEach(h => row[h] = "");

      row["Handle"] = product.handle;
      
      if (index === 0) {
        row["Title"] = product.title;
        row["Body (HTML)"] = product.description_html;
        row["Vendor"] = product.vendor;
        row["Product Category"] = product.category;
        row["Type"] = product.type;
        row["Tags"] = product.tags.join(", ");
        row["Published"] = "TRUE";
        row["Image Src"] = product.mainImageSrc;
        row["Image Position"] = "1";
        row["SEO Title"] = product.seo_title;
        row["SEO Description"] = product.seo_description;
        row["Status"] = "active";
        row["Gift Card"] = "FALSE";
      }

      row["Option1 Name"] = variant.option1Name;
      row["Option1 Value"] = variant.option1Value;
      row["Option2 Name"] = variant.option2Name;
      row["Option2 Value"] = variant.option2Value;
      row["Option3 Name"] = variant.option3Name;
      row["Option3 Value"] = variant.option3Value;
      
      row["Variant SKU"] = variant.sku;
      row["Variant Price"] = variant.price;
      row["Variant Compare At Price"] = variant.compareAtPrice;
      row["Variant Grams"] = "0";
      row["Variant Inventory Tracker"] = "shopify";
      row["Variant Inventory Policy"] = "deny";
      row["Variant Fulfillment Service"] = "manual";
      row["Variant Requires Shipping"] = "TRUE";
      row["Variant Taxable"] = "FALSE";
      row["Variant Image"] = variant.imageSrc;
      row["Variant Weight Unit"] = "kg";

      rows.push(row);
    });
  });

  const csv = Papa.unparse({
    fields: CSV_HEADERS,
    data: rows
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
