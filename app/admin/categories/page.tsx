'use client';

import { useState } from 'react';
import CategoriesTable from '@/components/admin/CategoriesTable';
import CategoryModal from '@/components/admin/CategoryModal';
import { Button } from '@/components/ui/button';
import { Plus, Search, FolderTree } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function CategoriesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [parentCategory, setParentCategory] = useState<any>(null);

  const handleEditCategory = (category: any) => {
    setSelectedCategory(category);
    setParentCategory(null);
    setIsModalOpen(true);
  };

  const handleAddSubcategory = (parent: any) => {
    setSelectedCategory(null);
    setParentCategory(parent);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCategory(null);
    setParentCategory(null);
  };

  const handleCategorySaved = () => {
    setIsModalOpen(false);
    setSelectedCategory(null);
    setParentCategory(null);
    // Force a re-render by reloading the page or updating state
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <FolderTree className="w-8 h-8 mr-3 text-blue-600" />
            Categories
          </h1>
          <p className="text-gray-600 mt-2">Organize your products with categories and subcategories</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-6 border-b">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <CategoriesTable 
          searchTerm={searchTerm}
          onEditCategory={handleEditCategory}
          onAddSubcategory={handleAddSubcategory}
        />
      </div>

      <CategoryModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        category={selectedCategory || (parentCategory ? { parent_id: parentCategory.id } : null)}
        onCategorySaved={handleCategorySaved}
      />
    </div>
  );
}