import { cookies } from "next/headers";

const API_BASE_URL = 'http://localhost:5000/api';

// Auth token management
let authToken: string | null = null;

export const setAuthToken = (token: string) => {
  authToken = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem('admin_token', token);
    setCookie('admin_token', token);
  }
};

export const setCookie = (name:string, value:string) => {
    if (typeof document !== 'undefined') {
      const days = 7;
      const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `${name}=${value}; path=/; expires=${expires}; SameSite=Strict`;
    }
  };

export const getAuthToken = () => {
  if (!authToken && typeof window !== 'undefined') {
    authToken = localStorage.getItem('admin_token');
  }
  return authToken;
};

export const removeAuthToken = () => {
  authToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('admin_token');
  }
};

// API request helper
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
};

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.token) {
      setAuthToken(response.token);
    }
    
    return response;
  },

  getCurrentUser: async () => {
    return apiRequest('/auth/me');
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    return apiRequest('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  logout: () => {
    removeAuthToken();
  },
};

// Products API
export const productsAPI = {
  getProducts: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    status?: string;
  } = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value.toString());
    });
    
    return apiRequest(`/products?${queryParams}`);
  },

  getProduct: async (id: string) => {
    return apiRequest(`/products/${id}`);
  },

  createProduct: async (productData: any) => {
    return apiRequest('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  },

  updateProduct: async (id: string, productData: any) => {
    return apiRequest(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  },

  deleteProduct: async (id: string) => {
    return apiRequest(`/products/${id}`, {
      method: 'DELETE',
    });
  },

  bulkUpdateStock: async (updates: { id: string; stock_quantity: number }[]) => {
    return apiRequest('/products/bulk/stock', {
      method: 'PUT',
      body: JSON.stringify({ updates }),
    });
  },
};

// Orders API
export const ordersAPI = {
  getOrders: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    payment_status?: string;
  } = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value.toString());
    });
    
    return apiRequest(`/orders?${queryParams}`);
  },

  getOrder: async (id: string) => {
    return apiRequest(`/orders/${id}`);
  },

  createOrder: async (orderData: any) => {
    return apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },

  updateOrderStatus: async (id: string, statusData: {
    status?: string;
    payment_status?: string;
    tracking_number?: string;
    notes?: string;
  }) => {
    return apiRequest(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(statusData),
    });
  },

  deleteOrder: async (id: string) => {
    return apiRequest(`/orders/${id}`, {
      method: 'DELETE',
    });
  },

  getOrderStats: async () => {
    return apiRequest('/orders/stats/overview');
  },
};

// Customers API
export const customersAPI = {
  getCustomers: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  } = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value.toString());
    });
    
    return apiRequest(`/customers?${queryParams}`);
  },

  getCustomer: async (id: string) => {
    return apiRequest(`/customers/${id}`);
  },

  createCustomer: async (customerData: any) => {
    return apiRequest('/customers', {
      method: 'POST',
      body: JSON.stringify(customerData),
    });
  },

  updateCustomer: async (id: string, customerData: any) => {
    return apiRequest(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(customerData),
    });
  },

  deleteCustomer: async (id: string) => {
    return apiRequest(`/customers/${id}`, {
      method: 'DELETE',
    });
  },

  addCustomerAddress: async (id: string, addressData: any) => {
    return apiRequest(`/customers/${id}/addresses`, {
      method: 'POST',
      body: JSON.stringify(addressData),
    });
  },

  getCustomerStats: async () => {
    return apiRequest('/customers/stats/overview');
  },
};

// Analytics API
export const analyticsAPI = {
  getDashboardStats: async () => {
    return apiRequest('/analytics/dashboard');
  },

  getRevenueChart: async () => {
    return apiRequest('/analytics/revenue-chart');
  },

  getTopProducts: async () => {
    return apiRequest('/analytics/top-products');
  },

  getRecentOrders: async () => {
    return apiRequest('/analytics/recent-orders');
  },

  getOrderStatus: async () => {
    return apiRequest('/analytics/order-status');
  },

  getCustomerGrowth: async () => {
    return apiRequest('/analytics/customer-growth');
  },
};

// Categories API
export const categoriesAPI = {
  getCategories: async (includeSubcategories: boolean = true) => {
    return apiRequest(`/categories?include_subcategories=${includeSubcategories}`);
  },

  getCategory: async (id: string) => {
    return apiRequest(`/categories/${id}`);
  },

  getSubcategories: async (parentId: string) => {
    return apiRequest(`/categories/${parentId}/subcategories`);
  },

  createCategory: async (categoryData: any) => {
    return apiRequest('/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  },

  updateCategory: async (id: string, categoryData: any) => {
    return apiRequest(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(categoryData),
    });
  },

  deleteCategory: async (id: string) => {
    return apiRequest(`/categories/${id}`, {
      method: 'DELETE',
    });
  },

  reorderCategories: async (categories: { id: string; sort_order: number }[]) => {
    return apiRequest('/categories/reorder', {
      method: 'PUT',
      body: JSON.stringify({ categories }),
    });
  },
};

// Banners API
export const bannersAPI = {
  getBanners: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  } = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value.toString());
    });
    
    return apiRequest(`/banners?${queryParams}`);
  },

  getActiveBanners: async () => {
    return apiRequest('/banners/active');
  },

  getBanner: async (id: string) => {
    return apiRequest(`/banners/${id}`);
  },

  createBanner: async (bannerData: any) => {
    return apiRequest('/banners', {
      method: 'POST',
      body: JSON.stringify(bannerData),
    });
  },

  updateBanner: async (id: string, bannerData: any) => {
    return apiRequest(`/banners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(bannerData),
    });
  },

  deleteBanner: async (id: string) => {
    return apiRequest(`/banners/${id}`, {
      method: 'DELETE',
    });
  },

  toggleBannerStatus: async (id: string) => {
    return apiRequest(`/banners/${id}/toggle`, {
      method: 'PUT',
    });
  },

  reorderBanners: async (banners: { id: string; display_order: number }[]) => {
    return apiRequest('/banners/reorder', {
      method: 'PUT',
      body: JSON.stringify({ banners }),
    });
  },
};