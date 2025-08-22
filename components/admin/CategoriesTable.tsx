'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Plus, MoreHorizontal, ChevronRight, ChevronDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { categoriesAPI } from '@/lib/api';

interface CategoriesTableProps {
  searchTerm: string;
  onEditCategory: (category: any) => void;
  onAddSubcategory: (parentCategory: any) => void;
}

export default function CategoriesTable({ searchTerm, onEditCategory, onAddSubcategory }: CategoriesTableProps) {
  const [categories, setCategories] = useState<any[]>([]);
  const [flatCategories, setFlatCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());

useEffect(() => {
  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await categoriesAPI.getCategories(true);

      const categories = response.categories; // top-level categories
      const flatCategories = response.flat_categories; // all categories

      // Recursive function to sum products for a category
      const calculateTotalProducts = (categoryId: any) => {
        const category = flatCategories.find((cat: { id: any; }) => cat.id === categoryId);
        let total = category?.product_count || 0;

        const children = flatCategories.filter((cat: { parent_id: any; }) => cat.parent_id === categoryId);
        children.forEach((child: { id: any; }) => {
          total += calculateTotalProducts(child.id);
        });

        return total;
      };

      // Enrich flat list for all categories (parents + subcategories)
      const enrichedFlatCategories = flatCategories.map((cat: { product_count: any; id: any; }) => ({
        ...cat,
        own_product_count: cat.product_count, // original API value
        total_product_count: calculateTotalProducts(cat.id) // recursive total
      }));

      // Enrich only top-level categories for parent display
      const updatedCategories = categories.map((cat: { product_count: any; id: any; }) => ({
        ...cat,
        own_product_count: cat.product_count,
        total_product_count: calculateTotalProducts(cat.id)
      }));

      setCategories(updatedCategories);
      setFlatCategories(enrichedFlatCategories);

    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  fetchCategories();
}, []);





  const handleDeleteCategory = async (categoryId: string) => {
    if (confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      try {
        await categoriesAPI.deleteCategory(categoryId);
        // Refresh the categories list
        const response = await categoriesAPI.getCategories(true);
        setCategories(response.categories);
        setFlatCategories(response.flat_categories);
      } catch (error: any) {
        console.error('Failed to delete category:', error);
        alert(error.message || 'Failed to delete category');
      }
    }
  };

  const toggleExpanded = (categoryId: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge className="bg-green-100 text-green-800">Active</Badge>
    ) : (
      <Badge variant="secondary" className="bg-gray-100 text-gray-800">Inactive</Badge>
    );
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.subcategories?.some((sub: any) =>
      sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );
/*
const renderCategoryRow = (
  category: any,
  isSubcategory = false,
  parentId?: number
) => {
  // If subcategory, use enriched version from flatCategories
  let displayCategory = category;
  if (isSubcategory) {
    const enriched = flatCategories.find(f => f.id === category.id);
    if (enriched) {
      displayCategory = enriched;
    }
  }

  return (
    <TableRow
      key={`${isSubcategory ? 'sub-' : ''}${displayCategory.id}`}
      className={`hover:bg-gray-50 ${isSubcategory ? 'bg-gray-25' : ''}`}
    >
      <TableCell>
        <div className="flex items-center space-x-3">
          {!isSubcategory && displayCategory.subcategories?.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleExpanded(displayCategory.id)}
              className="p-1 h-6 w-6"
            >
              {expandedCategories.has(displayCategory.id) ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          )}
          {isSubcategory && <div className="w-6" />}
          <Avatar className="h-10 w-10">
            <AvatarImage src={displayCategory.image_url} alt={displayCategory.name} />
            <AvatarFallback>{displayCategory.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <div className={`font-medium ${isSubcategory ? 'text-gray-700 text-sm' : 'text-gray-900'}`}>
              {isSubcategory && '└ '}{displayCategory.name}
            </div>
            <div className="text-sm text-gray-500">
              {displayCategory.slug} {displayCategory.parent_name && `• Parent: ${displayCategory.parent_name}`}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm text-gray-600 max-w-xs truncate">
          {displayCategory.description || 'No description'}
        </div>
      </TableCell>
      <TableCell>
        {isSubcategory
          ? `${displayCategory.own_product_count || 0} products`
          : `${displayCategory.total_product_count || 0} products`
        }
      </TableCell>
      <TableCell>{getStatusBadge(displayCategory.is_active)}</TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditCategory(displayCategory)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Category
            </DropdownMenuItem>
            {!isSubcategory && (
              <DropdownMenuItem onClick={() => onAddSubcategory(displayCategory)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Subcategory
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              className="text-red-600"
              onClick={() => handleDeleteCategory(displayCategory.id.toString())}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Category
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};
*/
const renderCategoryRow = (
  category: any,
  isSubcategory = false,
  parentId?: number
) => {
  // If subcategory, use enriched version from flatCategories
  let displayCategory = category;
  if (isSubcategory) {
    const enriched = flatCategories.find(f => f.id === category.id);
    if (enriched) {
      displayCategory = enriched;
    }
  }

  // Helper to format product count with singular/plural
  const formatProductLabel = (count: number) => {
    const safeCount = count || 0;
    return `${safeCount} Product${safeCount === 1 ? '' : 's'}`;
  };

  return (
    <TableRow
      key={`${isSubcategory ? 'sub-' : ''}${displayCategory.id}`}
      className={`hover:bg-gray-50 ${isSubcategory ? 'bg-gray-25' : ''}`}
    >
      <TableCell>
        <div className="flex items-center space-x-3">
          {!isSubcategory && displayCategory.subcategories?.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleExpanded(displayCategory.id)}
              className="p-1 h-6 w-6"
            >
              {expandedCategories.has(displayCategory.id) ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          )}
          {isSubcategory && <div className="w-6" />}
          <Avatar className="h-10 w-10">
            <AvatarImage src={displayCategory.image_url} alt={displayCategory.name} />
            <AvatarFallback>{displayCategory.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <div className={`font-medium ${isSubcategory ? 'text-gray-700 text-sm' : 'text-gray-900'}`}>
              {isSubcategory && '└ '}{displayCategory.name}
            </div>
            <div className="text-sm text-gray-500">
              {displayCategory.slug} {displayCategory.parent_name && `• Parent: ${displayCategory.parent_name}`}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm text-gray-600 max-w-xs truncate">
          {displayCategory.description || 'No description'}
        </div>
      </TableCell>
      <TableCell>
        {isSubcategory
          ? formatProductLabel(displayCategory.own_product_count)
          : formatProductLabel(displayCategory.total_product_count)
        }
      </TableCell>
      <TableCell>{getStatusBadge(displayCategory.is_active)}</TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditCategory(displayCategory)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Category
            </DropdownMenuItem>
            {!isSubcategory && (
              <DropdownMenuItem onClick={() => onAddSubcategory(displayCategory)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Subcategory
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              className="text-red-600"
              onClick={() => handleDeleteCategory(displayCategory.id.toString())}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Category
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};



  if (loading) {
    return (
      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                      <div className="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
                    </div>
                  </div>
                </TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded w-8 animate-pulse"></div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Products</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredCategories.map((category) => (
            <>
              {renderCategoryRow(category)}
              {expandedCategories.has(category.id) && category.subcategories?.map((subcategory: any) =>
                renderCategoryRow(subcategory, true, category.id)
              )}
            </>
          ))}
        </TableBody>
      </Table>

      {filteredCategories.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500">No categories found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}