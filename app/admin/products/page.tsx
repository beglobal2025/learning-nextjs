'use client';

import { useState, useEffect, SetStateAction } from 'react';
import ProductsTable from '@/components/admin/ProductsTable';
import ProductModal from '@/components/admin/ProductModal';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { categoriesAPI } from '@/lib/api';


export default function ProductsPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);

    useEffect(() => {
      const fetchCategories = async () => {
        try {
          const response = await categoriesAPI.getCategories(true);
          // Flatten all categories
          const allCategories: SetStateAction<any[]> = [];
          response.categories.forEach((category: any) => {
            allCategories.push(category);
          });
          setCategories(allCategories);
        } catch (error) {
          console.error('Failed to fetch categories:', error);
        }
      };
  
      //if (isOpen) {
        fetchCategories();
      //}
    }, []);

  const handleEditProduct = (product: any) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const handleProductSaved = () => {
    // This will trigger a re-fetch in ProductsTable
    setIsModalOpen(false);
    setSelectedProduct(null);
    // Force a re-render by updating a key or state
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 mt-2">Manage your product inventory and details</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-6 border-b">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Categories </SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.display_name || category.name}
                  </SelectItem>
                ))}
              </SelectContent>

            </Select>
          </div>
        </div>
      
        <ProductsTable 
          searchTerm={searchTerm}
          selectedCategory={selectedCategory}
          onEditProduct={handleEditProduct}
        />
      </div>

      <ProductModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        product={selectedProduct}
        onProductSaved={handleProductSaved}
      />
    </div>
  );
}