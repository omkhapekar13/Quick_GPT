import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const Loading = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser, fetchUser } = useAppContext();

  useEffect(() => {
    const success = searchParams.get('success');
    const credits = searchParams.get('credits');
    const error = searchParams.get('error');

    if (success === 'true') {
      if (credits) {
        setUser(prev => prev ? { ...prev, credits: Number(credits) } : null);
      } else {
        fetchUser();
      }
      toast.success("Payment completed successfully!");
      navigate('/');
    } else if (error) {
      toast.error(error);
      navigate('/');
    } else {
      // Fallback timeout in case no params are provided
      const timeout = setTimeout(() => {
        navigate('/');
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [searchParams, navigate, setUser, fetchUser]);

  return (
    <div className='bg-gradient-to-b from-[#531881] to-[#291848] backdrop-opacity-60 flex items-center justify-center h-screen w-screen text-white text-2xl'>
      <div className='w-10 h-10 rounded-full border-3 border-white border-t-transparent animate-spin'></div>
    </div>
  )
}

export default Loading;