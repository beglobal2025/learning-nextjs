'use client';

import { useState } from 'react';
import BannersTable from '@/components/admin/BannersTable';
import BannerModal from '@/components/admin/BannerModal';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter, Image } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function BannersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBanner, setSelectedBanner] = useState(null);

  const handleEditBanner = (banner: any) => {
    setSelectedBanner(banner);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedBanner(null);
  };

  const handleBannerSaved = () => {
    setIsModalOpen(false);
    setSelectedBanner(null);
    // Force a re-render by reloading the page or updating state
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Image className="w-8 h-8 mr-3 text-blue-600" />
            Banners
          </h1>
          <p className="text-gray-600 mt-2">Create and manage promotional banners with custom text overlays</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Banner
        </Button>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-6 border-b">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search banners by title or text..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <BannersTable 
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          onEditBanner={handleEditBanner}
        />
      </div>

      <BannerModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        banner={selectedBanner}
        onBannerSaved={handleBannerSaved}
      />
    </div>
  );
}