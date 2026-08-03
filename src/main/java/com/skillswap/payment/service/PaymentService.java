package com.skillswap.payment.service;

import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.skillswap.payment.dto.PaymentOrderRequest;
import com.skillswap.payment.dto.PaymentVerificationRequest;
import com.skillswap.payment.entity.Payment;
import com.skillswap.payment.repository.PaymentRepository;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Service
public class PaymentService {

    @Autowired
    private RazorpayClient razorpayClient;

    @Autowired
    private PaymentRepository paymentRepository;

    @Value("${razorpay.key.secret}")
    private String keySecret;

    public Map<String, Object> createOrder(PaymentOrderRequest request) throws RazorpayException {
        // Check maximum payment limit
        int successfulPayments = paymentRepository.countByUserIdAndStatus(request.getUserId(), "SUCCESS");
        if (successfulPayments >= 2) {
            throw new RuntimeException("Maximum payment limit reached.");
        }

        JSONObject orderRequest = new JSONObject();
        orderRequest.put("amount", request.getAmount() * 100); // amount in the smallest currency unit
        orderRequest.put("currency", "INR");
        orderRequest.put("receipt", "txn_" + System.currentTimeMillis());

        Order order = razorpayClient.orders.create(orderRequest);

        Map<String, Object> response = new HashMap<>();
        response.put("orderId", order.get("id"));
        response.put("amount", request.getAmount());
        response.put("currency", order.get("currency"));

        return response;
    }

    public String verifyPayment(PaymentVerificationRequest request) {
        try {
            String payload = request.getRazorpayOrderId() + "|" + request.getRazorpayPaymentId();
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(keySecret.getBytes(), "HmacSHA256"));
            byte[] hexBytes = new org.apache.commons.codec.binary.Hex().encode(mac.doFinal(payload.getBytes()));
            String generatedSignature = new String(hexBytes);

            if (generatedSignature.equals(request.getRazorpaySignature())) {
                int count = paymentRepository.countByUserIdAndStatus(request.getUserId(), "SUCCESS");
                
                Payment payment = new Payment();
                payment.setUserId(request.getUserId());
                payment.setPaymentId(request.getRazorpayPaymentId());
                payment.setOrderId(request.getRazorpayOrderId());
                payment.setAmount(request.getAmount());
                payment.setStatus("SUCCESS");
                payment.setPaymentMethod("RAZORPAY");
                payment.setPaymentCount(count + 1);
                payment.setCreatedAt(LocalDateTime.now());
                
                paymentRepository.save(payment);
                
                return "SUCCESS";
            } else {
                return "FAILED";
            }
        } catch (Exception e) {
            e.printStackTrace();
            return "ERROR";
        }
    }
}
