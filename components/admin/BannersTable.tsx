'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Eye, MoreHorizontal, Power, PowerOff } from 'lucide-react';
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
import { bannersAPI } from '@/lib/api';

interface BannersTableProps {
  searchTerm: string;
  statusFilter: string;
  onEditBanner: (banner: any) => void;
}

export default function BannersTable({ searchTerm, statusFilter, onEditBanner }: BannersTableProps) {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchBanners = async () => {
      setLoading(true);
      try {
        const response = await bannersAPI.getBanners({
          page: currentPage,
          limit: 10,
          search: searchTerm,
          status: statusFilter === 'all' ? '' : statusFilter,
        });
        setBanners(response.banners);
        setPagination(response.pagination);
      } catch (error) {
        console.error('Failed to fetch banners:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, [searchTerm, statusFilter, currentPage]);

  const handleDeleteBanner = async (bannerId: string) => {
    if (confirm('Are you sure you want to delete this banner?')) {
      try {
        await bannersAPI.deleteBanner(bannerId);
        // Refresh the banners list
        const response = await bannersAPI.getBanners({
          page: currentPage,
          limit: 10,
          search: searchTerm,
          status: statusFilter === 'all' ? '' : statusFilter,
        });
        setBanners(response.banners);
        setPagination(response.pagination);
      } catch (error) {
        console.error('Failed to delete banner:', error);
        alert('Failed to delete banner');
      }
    }
  };

  const handleToggleStatus = async (bannerId: string) => {
    try {
      await bannersAPI.toggleBannerStatus(bannerId);
      // Refresh the banners list
      const response = await bannersAPI.getBanners({
        page: currentPage,
        limit: 10,
        search: searchTerm,
        status: statusFilter === 'all' ? '' : statusFilter,
      });
      setBanners(response.banners);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Failed to toggle banner status:', error);
      alert('Failed to toggle banner status');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: 'Active', className: 'bg-green-100 text-green-800' },
      inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-800' },
      scheduled: { label: 'Scheduled', className: 'bg-blue-100 text-blue-800' },
      expired: { label: 'Expired', className: 'bg-red-100 text-red-800' },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Banner</TableHead>
              <TableHead>Text Overlay</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <div className="h-16 w-24 bg-gray-200 rounded animate-pulse"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                      <div className="h-3 bg-gray-200 rounded w-48 animate-pulse"></div>
                    </div>
                  </div>
                </TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded w-8 animate-pulse"></div></TableCell>
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
            <TableHead>Banner</TableHead>
            <TableHead>Text Overlay</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Order</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {banners.map((banner) => (
            <TableRow key={banner.id} className="hover:bg-gray-50">
              <TableCell>
                <div className="flex items-center space-x-3">
                  <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={banner.image_url}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                    />
                    {banner.background_overlay && (
                      <div 
                        className="absolute inset-0 bg-black"
                        style={{ opacity: banner.overlay_opacity }}
                      />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{banner.title}</div>
                    <div className="text-sm text-gray-500 max-w-xs truncate">
                      {banner.description || 'No description'}
                    </div>
                    {banner.link_url && (
                      <div className="text-xs text-blue-600 truncate max-w-xs">
                        {banner.link_url}
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="max-w-xs">
                  {banner.text_overlay ? (
                    <div className="text-sm text-gray-700 whitespace-pre-line truncate">
                      {banner.text_overlay}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">No text</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {banner.text_position.replace('-', ' ')}
                </Badge>
              </TableCell>
              <TableCell>{getStatusBadge(banner.status)}</TableCell>
              <TableCell>
                <span className="text-sm font-mono">{banner.display_order}</span>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Eye className="w-4 h-4 mr-2" />
                      Preview Banner
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEditBanner(banner)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Banner
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleStatus(banner.id.toString())}>
                      {banner.is_active ? (
                        <>
                          <PowerOff className="w-4 h-4 mr-2" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Power className="w-4 h-4 mr-2" />
                          Activate
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-red-600"
                      onClick={() => handleDeleteBanner(banner.id.toString())}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Banner
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {banners.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500">No banners found matching your criteria.</p>
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between px-6 py-4">
          <div className="text-sm text-gray-500">
            Showing {((currentPage - 1) * pagination.limit) + 1} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} banners
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.pages))}
              disabled={currentPage === pagination.pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}