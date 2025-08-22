'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { bannersAPI } from '@/lib/api';
import { Loader2, Eye, EyeOff } from 'lucide-react';

interface BannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  banner: any;
  onBannerSaved?: () => void;
}

export default function BannerModal({ isOpen, onClose, banner, onBannerSaved }: BannerModalProps) {
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    text_overlay: '',
    text_position: 'center',
    text_color: '#ffffff',
    text_size: 'large',
    background_overlay: false,
    overlay_opacity: 0.5,
    link_url: '',
    link_text: '',
    is_active: true,
    display_order: 0,
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    if (banner) {
      setFormData({
        title: banner.title || '',
        description: banner.description || '',
        image_url: banner.image_url || '',
        text_overlay: banner.text_overlay || '',
        text_position: banner.text_position || 'center',
        text_color: banner.text_color || '#ffffff',
        text_size: banner.text_size || 'large',
        background_overlay: banner.background_overlay || false,
        overlay_opacity: banner.overlay_opacity || 0.5,
        link_url: banner.link_url || '',
        link_text: banner.link_text || '',
        is_active: banner.is_active !== undefined ? banner.is_active : true,
        display_order: banner.display_order || 0,
        start_date: banner.start_date ? banner.start_date.split('T')[0] : '',
        end_date: banner.end_date ? banner.end_date.split('T')[0] : '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        image_url: '',
        text_overlay: '',
        text_position: 'center',
        text_color: '#ffffff',
        text_size: 'large',
        background_overlay: false,
        overlay_opacity: 0.5,
        link_url: '',
        link_text: '',
        is_active: true,
        display_order: 0,
        start_date: '',
        end_date: '',
      });
    }
  }, [banner]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const bannerData = {
        ...formData,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
      };

      if (banner) {
        await bannersAPI.updateBanner(banner.id.toString(), bannerData);
      } else {
        await bannersAPI.createBanner(bannerData);
      }

      onBannerSaved?.();
      onClose();
    } catch (error: any) {
      console.error('Failed to save banner:', error);
      alert(error.message || 'Failed to save banner');
    } finally {
      setSaving(false);
    }
  };

  const getTextSizeClass = (size: string) => {
    switch (size) {
      case 'small': return 'text-sm';
      case 'medium': return 'text-lg';
      case 'large': return 'text-2xl';
      case 'xl': return 'text-4xl';
      default: return 'text-2xl';
    }
  };

  const getPositionClass = (position: string) => {
    switch (position) {
      case 'top-left': return 'top-4 left-4';
      case 'top-right': return 'top-4 right-4';
      case 'bottom-left': return 'bottom-4 left-4';
      case 'bottom-right': return 'bottom-4 right-4';
      case 'center': return 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';
      default: return 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{banner ? 'Edit Banner' : 'Add New Banner'}</DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </Button>
          </div>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form Section */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Banner Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter banner title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter banner description"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image_url">Image URL</Label>
              <Input
                id="image_url"
                value={formData.image_url}
                onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                placeholder="Enter image URL"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="text_overlay">Text Overlay</Label>
              <Textarea
                id="text_overlay"
                value={formData.text_overlay}
                onChange={(e) => setFormData(prev => ({ ...prev, text_overlay: e.target.value }))}
                placeholder="Enter text to display on banner (use \n for line breaks)"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="text_position">Text Position</Label>
                <Select value={formData.text_position} onValueChange={(value) => setFormData(prev => ({ ...prev, text_position: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="top-left">Top Left</SelectItem>
                    <SelectItem value="top-right">Top Right</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="text_size">Text Size</Label>
                <Select value={formData.text_size} onValueChange={(value) => setFormData(prev => ({ ...prev, text_size: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                    <SelectItem value="xl">Extra Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="text_color">Text Color</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="text_color"
                  type="color"
                  value={formData.text_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, text_color: e.target.value }))}
                  className="w-16 h-10"
                />
                <Input
                  value={formData.text_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, text_color: e.target.value }))}
                  placeholder="#ffffff"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="background_overlay"
                  checked={formData.background_overlay}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, background_overlay: checked }))}
                />
                <Label htmlFor="background_overlay">Add background overlay</Label>
              </div>

              {formData.background_overlay && (
                <div className="space-y-2">
                  <Label>Overlay Opacity: {Math.round(formData.overlay_opacity * 100)}%</Label>
                  <Slider
                    value={[formData.overlay_opacity]}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, overlay_opacity: value[0] }))}
                    max={1}
                    min={0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="link_url">Link URL</Label>
                <Input
                  id="link_url"
                  value={formData.link_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
                  placeholder="Enter link URL"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="link_text">Link Text</Label>
                <Input
                  id="link_text"
                  value={formData.link_text}
                  onChange={(e) => setFormData(prev => ({ ...prev, link_text: e.target.value }))}
                  placeholder="Enter link text"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="display_order">Display Order</Label>
                <Input
                  id="display_order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Banner is active</Label>
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {banner ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  banner ? 'Update Banner' : 'Create Banner'
                )}
              </Button>
            </div>
          </form>

          {/* Preview Section */}
          {showPreview && formData.image_url && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Preview</h3>
              <div className="relative w-full h-64 rounded-lg overflow-hidden border">
                <img
                  src={formData.image_url}
                  alt="Banner preview"
                  className="w-full h-full object-cover"
                />
                
                {formData.background_overlay && (
                  <div 
                    className="absolute inset-0 bg-black"
                    style={{ opacity: formData.overlay_opacity }}
                  />
                )}

                {formData.text_overlay && (
                  <div className={`absolute ${getPositionClass(formData.text_position)} z-10`}>
                    <div
                      className={`font-bold ${getTextSizeClass(formData.text_size)} text-center whitespace-pre-line`}
                      style={{ color: formData.text_color }}
                    >
                      {formData.text_overlay}
                    </div>
                    {formData.link_text && (
                      <div className="mt-2 text-center">
                        <span
                          className="inline-block px-4 py-2 bg-white text-black rounded-lg font-medium text-sm hover:bg-gray-100 transition-colors"
                        >
                          {formData.link_text}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Title:</strong> {formData.title || 'No title'}</p>
                <p><strong>Description:</strong> {formData.description || 'No description'}</p>
                {formData.link_url && <p><strong>Link:</strong> {formData.link_url}</p>}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}